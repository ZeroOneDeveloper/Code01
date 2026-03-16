/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  RealtimePostgresChangesPayload,
  SupabaseLikeError,
  User,
} from "./types";
import { getClientApiBaseUrl, getServerApiBaseUrl } from "../api-base";

type QueryFilter = {
  op: "eq" | "in";
  column: string;
  value: unknown;
};

type QueryOrder = {
  column: string;
  ascending: boolean;
};

type QueryResult<T> = {
  data: T | null;
  error: SupabaseLikeError | null;
  count?: number | null;
};

type RawResponse = {
  rows?: unknown[];
  count?: number | null;
  error?: { message?: string } | string | null;
};

type RequestContext = {
  cookieHeader?: string;
  onSetCookie?: (setCookies: string[]) => void;
};

type AuthResponse<T> = Promise<{ data: T; error: SupabaseLikeError | null }>;

const POLL_INTERVAL_MS = 1000;

function isBrowser() {
  return typeof window !== "undefined";
}

function getApiBaseUrl() {
  if (isBrowser()) {
    return getClientApiBaseUrl();
  }

  return getServerApiBaseUrl();
}

function toError(message: string): SupabaseLikeError {
  return { message };
}

function getErrorMessage(
  error: RawResponse["error"] | undefined | null,
  fallback: string,
) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return error.message ?? fallback;
}

function normalizeTableName(name: string) {
  return name.trim().toLowerCase().replace(/-/g, "_");
}

function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }

    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }

    if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = "";
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) out.push(trimmed);
  return out;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseLiteral(value: string): unknown {
  const raw = stripQuotes(value);
  const lowered = raw.toLowerCase();

  if (lowered === "null") return null;
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return Number.parseFloat(raw);

  return raw;
}

function parseOrExpression(expression: string): QueryFilter[] {
  const segments = splitTopLevel(expression);
  const filters: QueryFilter[] = [];

  for (const segment of segments) {
    const inMatch = segment.match(/^([a-zA-Z0-9_]+)\.in\.\((.*)\)$/);
    if (inMatch) {
      const [, column, valuesRaw] = inMatch;
      const values = splitTopLevel(valuesRaw).map(parseLiteral);
      filters.push({ op: "in", column, value: values });
      continue;
    }

    const eqMatch = segment.match(/^([a-zA-Z0-9_]+)\.eq\.(.*)$/);
    if (eqMatch) {
      const [, column, valueRaw] = eqMatch;
      filters.push({ op: "eq", column, value: parseLiteral(valueRaw) });
    }
  }

  return filters;
}

function projectRows<T = Record<string, unknown>>(
  rows: Record<string, unknown>[],
  columns: string,
): T[] {
  const trimmed = columns.trim();
  if (!trimmed || trimmed === "*") {
    return rows as T[];
  }

  const picked = trimmed
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    picked.forEach((key) => {
      projected[key] = row[key];
    });
    return projected as T;
  });
}

function parseRealtimeFilter(filter: string | undefined): QueryFilter[] {
  if (!filter) return [];

  const eq = filter.match(/^([a-zA-Z0-9_]+)=eq\.(.*)$/);
  if (eq) {
    return [{ op: "eq", column: eq[1], value: parseLiteral(eq[2]) }];
  }

  return [];
}

function extractSetCookies(headers: Headers): string[] {
  const anyHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }

  const single = headers.get("set-cookie");
  if (!single) return [];
  return [single];
}

async function requestJson(
  context: RequestContext,
  path: string,
  init: RequestInit & { bodyJson?: unknown } = {},
): Promise<RawResponse> {
  const headers = new Headers(init.headers ?? {});
  let body = init.body;

  if (init.bodyJson !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.bodyJson);
  }

  const isServer = !isBrowser();

  if (isServer && context.cookieHeader) {
    headers.set("cookie", context.cookieHeader);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    body,
    headers,
    // credentials: "include" is needed in the browser to send cookies
    // cross-origin.  On the server we forward cookies via the header
    // above, and setting credentials can cause Node/undici to drop the
    // manually-set Cookie header.
    ...(isServer ? {} : { credentials: "include" as RequestCredentials }),
    cache: "no-store",
  });

  const setCookies = extractSetCookies(response.headers);
  if (setCookies.length > 0 && context.onSetCookie) {
    context.onSetCookie(setCookies);
  }

  let payload: RawResponse | null = null;
  try {
    payload = (await response.json()) as RawResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      getErrorMessage(payload?.error, `Request failed (${response.status})`) ||
      (payload as { detail?: string } | null)?.detail ||
      `Request failed (${response.status})`;

    return {
      rows: [],
      count: null,
      error: { message },
    };
  }

  return payload ?? { rows: [], count: null, error: null };
}

class QueryBuilder implements PromiseLike<any> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private columns = "*";
  private returningColumns = "*";
  private filters: QueryFilter[] = [];
  private orFilters: QueryFilter[] = [];
  private orderBy: QueryOrder | null = null;
  private from: number | null = null;
  private to: number | null = null;
  private countExact = false;
  private headOnly = false;
  private mutationPayload: unknown = null;
  private returningRequested = false;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(
    private readonly context: RequestContext,
    private readonly table: string,
  ) {}

  private normalizedTable() {
    return normalizeTableName(this.table);
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    if (this.action === "select") {
      this.columns = columns;
      this.countExact = options?.count === "exact";
      this.headOnly = options?.head === true;
    } else {
      this.returningRequested = true;
      this.returningColumns = columns;
    }
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.action = "insert";
    this.mutationPayload = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.action = "update";
    this.mutationPayload = values;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ op: "in", column, value: values });
    return this;
  }

  or(expression: string) {
    this.orFilters.push(...parseOrExpression(expression));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending !== false,
    };
    return this;
  }

  range(from: number, to: number) {
    this.from = from;
    this.to = to;
    return this;
  }

  single() {
    this.singleMode = "single";
    if (this.action !== "select") {
      this.returningRequested = true;
    }
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    if (this.action !== "select") {
      this.returningRequested = true;
    }
    return this;
  }

  private normalizeSelectRows(rawRows: unknown[]): Record<string, any>[] {
    return rawRows.filter((row): row is Record<string, any> => !!row);
  }

  private applySingleMode(rows: Record<string, any>[]): QueryResult<any> {
    if (this.singleMode === null) {
      return { data: rows, error: null };
    }

    if (rows.length === 1) {
      return { data: rows[0], error: null };
    }

    if (rows.length === 0 && this.singleMode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (rows.length === 0 && this.singleMode === "single") {
      return { data: null, error: toError("No rows found") };
    }

    return { data: null, error: toError("Multiple rows found") };
  }

  private async executeSelect(): Promise<any> {
    const response = await requestJson(this.context, "/db/select", {
      method: "POST",
      bodyJson: {
        table: this.normalizedTable(),
        columns: this.columns,
        filters: this.filters,
        or_filters: this.orFilters,
        order: this.orderBy,
        range_from: this.from,
        range_to: this.to,
        count: this.countExact,
        head: this.headOnly,
      },
    });

    if (response.error) {
      return { data: null, error: toError(getErrorMessage(response.error, "Query failed")) };
    }

    if (this.headOnly) {
      return { data: null, error: null, count: response.count ?? null };
    }

    const rows = this.normalizeSelectRows(response.rows ?? []);
    const single = this.applySingleMode(rows);

    return {
      ...single,
      count: response.count ?? null,
    };
  }

  private async executeMutation(): Promise<any> {
    const path =
      this.action === "insert"
        ? "/db/insert"
        : this.action === "update"
          ? "/db/update"
          : "/db/delete";

    const response = await requestJson(this.context, path, {
      method: "POST",
      bodyJson:
        this.action === "insert"
          ? {
              table: this.normalizedTable(),
              values: this.mutationPayload,
              returning: this.returningRequested || this.singleMode !== null,
            }
          : this.action === "update"
            ? {
                table: this.normalizedTable(),
                values: this.mutationPayload,
                filters: this.filters,
                or_filters: this.orFilters,
                returning: this.returningRequested || this.singleMode !== null,
              }
            : {
                table: this.normalizedTable(),
                filters: this.filters,
                or_filters: this.orFilters,
                returning: this.returningRequested || this.singleMode !== null,
              },
    });

    if (response.error) {
      return {
        data: null,
        error: toError(getErrorMessage(response.error, "Mutation failed")),
      };
    }

    if (!this.returningRequested && this.singleMode === null) {
      return { data: null, error: null, count: response.count ?? null };
    }

    const rows = this.normalizeSelectRows(response.rows ?? []);
    const projected = projectRows(rows, this.returningColumns);
    const single = this.applySingleMode(projected);

    return {
      ...single,
      count: response.count ?? null,
    };
  }

  private async execute(): Promise<any> {
    if (this.action === "select") {
      return this.executeSelect();
    }
    return this.executeMutation();
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<any | TResult> {
    return this.execute().catch(onrejected ?? undefined);
  }

  finally(onfinally?: (() => void) | null): Promise<any> {
    return this.execute().finally(onfinally ?? undefined);
  }
}

class StorageBucket {
  constructor(
    private readonly context: RequestContext,
    private readonly bucket: string,
  ) {}

  async upload(
    path: string,
    file: File,
    options?: { upsert?: boolean; contentType?: string },
  ): Promise<{ data: { path: string } | null; error: SupabaseLikeError | null }> {
    const formData = new FormData();
    formData.append("bucket", this.bucket);
    formData.append("path", path);
    formData.append("upsert", String(options?.upsert === true));
    formData.append("file", file);

    const isServer = !isBrowser();
    const headers = new Headers();
    if (isServer && this.context.cookieHeader) {
      headers.set("cookie", this.context.cookieHeader);
    }

    const response = await fetch(`${getApiBaseUrl()}/storage/upload`, {
      method: "POST",
      body: formData,
      headers,
      ...(isServer ? {} : { credentials: "include" as RequestCredentials }),
      cache: "no-store",
    });

    const setCookies = extractSetCookies(response.headers);
    if (setCookies.length > 0 && this.context.onSetCookie) {
      this.context.onSetCookie(setCookies);
    }

    let payload: {
      path?: string;
      error?: { message?: string } | string | null;
    } | null = null;

    try {
      payload = (await response.json()) as {
        path?: string;
        error?: { message?: string } | string | null;
      };
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message = getErrorMessage(
        payload?.error,
        `Upload failed (${response.status})`,
      );
      return { data: null, error: toError(message) };
    }

    return { data: { path: payload?.path ?? path }, error: null };
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    const normalizedPath = [this.bucket, path]
      .map((part) => part.split("/").map(encodeURIComponent).join("/"))
      .join("/");

    return {
      data: {
        publicUrl: `${getApiBaseUrl()}/uploads/${normalizedPath}`,
      },
    };
  }
}

class RealtimeChannel {
  private table = "";
  private schema = "public";
  private filters: QueryFilter[] = [];
  private callback:
    | ((payload: RealtimePostgresChangesPayload<Record<string, any>>) => void)
    | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private lastSignature = "";
  private lastRow: Record<string, unknown> | null = null;

  constructor(
    private readonly context: RequestContext,
    private readonly name: string,
  ) {}

  on<T extends Record<string, any> = Record<string, any>>(
    _event: "postgres_changes",
    params: {
      event?: string;
      schema?: string;
      table: string;
      filter?: string;
    },
    callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  ) {
    this.table = normalizeTableName(params.table);
    this.schema = params.schema ?? "public";
    this.filters = parseRealtimeFilter(params.filter);
    this.callback = callback as (
      payload: RealtimePostgresChangesPayload<Record<string, any>>,
    ) => void;
    return this;
  }

  private signature(rows: Record<string, any>[]) {
    return JSON.stringify(
      rows.map((row) => [
        row.id,
        row.status_code,
        row.cases_done,
        row.cases_total,
        row.submitted_at,
        row.updated_at,
      ]),
    );
  }

  private async pollOnce() {
    if (!this.table || !this.callback) return;

    const response = await requestJson(this.context, "/db/select", {
      method: "POST",
      bodyJson: {
        table: this.table,
        columns: "*",
        filters: this.filters,
        or_filters: [],
        order: { column: "id", ascending: false },
        range_from: 0,
        range_to: this.filters.length > 0 ? 0 : 99,
        count: false,
        head: false,
      },
    });

    if (response.error) return;

    const rows = (response.rows ?? []).filter(
      (row): row is Record<string, any> => !!row,
    );
    const nextSignature = this.signature(rows);

    if (!this.initialized) {
      this.initialized = true;
      this.lastSignature = nextSignature;
      this.lastRow = rows[0] ?? null;
      return;
    }

    if (nextSignature === this.lastSignature) return;

    const payload: RealtimePostgresChangesPayload<Record<string, any>> = {
      schema: this.schema,
      table: this.table,
      eventType: "UPDATE",
      new: rows[0] ?? null,
      old: this.lastRow,
    };

    this.lastSignature = nextSignature;
    this.lastRow = rows[0] ?? null;
    this.callback(payload);
  }

  subscribe() {
    if (this.timer) return this;

    void this.pollOnce();
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, POLL_INTERVAL_MS);

    return this;
  }

  unsubscribe() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get channelName() {
    return this.name;
  }
}

class Code01Client {
  constructor(private readonly context: RequestContext) {}

  from(table: string) {
    return new QueryBuilder(this.context, table);
  }

  channel(name: string) {
    return new RealtimeChannel(this.context, name);
  }

  removeChannel(channel: RealtimeChannel) {
    channel.unsubscribe();
    return Promise.resolve({ data: { message: "ok" }, error: null });
  }

  storage = {
    from: (bucket: string) => new StorageBucket(this.context, bucket),
  };

  auth = {
    getUser: async (): AuthResponse<{ user: User | null }> => {
      const response = await requestJson(this.context, "/auth/me", {
        method: "GET",
      });

      if (response.error) {
        return {
          data: { user: null },
          error: toError(getErrorMessage(response.error, "Failed to fetch user")),
        };
      }

      const rows = response as unknown as { user?: User | null };
      return {
        data: { user: rows.user ?? null },
        error: null,
      };
    },

    signUp: async (payload: {
      email: string;
      password: string;
      options?: {
        emailRedirectTo?: string;
        data?: {
          student_id?: string;
          name?: string;
          nickname?: string;
        };
      };
    }): AuthResponse<{ user: User | null }> => {
      const response = await requestJson(this.context, "/auth/signup", {
        method: "POST",
        bodyJson: {
          email: payload.email,
          password: payload.password,
          student_id: payload.options?.data?.student_id,
          name: payload.options?.data?.name,
          nickname: payload.options?.data?.nickname,
        },
      });

      if (response.error) {
        return {
          data: { user: null },
          error: toError(getErrorMessage(response.error, "Sign up failed")),
        };
      }

      const res = response as unknown as { user?: User | null };
      return {
        data: { user: res.user ?? null },
        error: null,
      };
    },

    signInWithPassword: async (payload: {
      email: string;
      password: string;
    }): AuthResponse<{ user: User | null }> => {
      const response = await requestJson(this.context, "/auth/login", {
        method: "POST",
        bodyJson: payload,
      });

      if (response.error) {
        return {
          data: { user: null },
          error: toError(getErrorMessage(response.error, "Login failed")),
        };
      }

      const res = response as unknown as { user?: User | null };
      return {
        data: { user: res.user ?? null },
        error: null,
      };
    },

    signOut: async (): Promise<{ error: SupabaseLikeError | null }> => {
      const response = await requestJson(this.context, "/auth/logout", {
        method: "POST",
      });

      if (response.error) {
        return {
          error: toError(getErrorMessage(response.error, "Logout failed")),
        };
      }

      return { error: null };
    },

    resetPasswordForEmail: async (
      email: string,
      options?: { redirectTo?: string },
    ): Promise<{ data: null; error: SupabaseLikeError | null }> => {
      const response = await requestJson(this.context, "/auth/password-reset/request", {
        method: "POST",
        bodyJson: {
          email,
          redirect_to: options?.redirectTo,
        },
      });

      if (response.error) {
        return {
          data: null,
          error: toError(getErrorMessage(response.error, "Password reset request failed")),
        };
      }

      return { data: null, error: null };
    },

    confirmPasswordReset: async (payload: {
      token: string;
      password: string;
    }): Promise<{ data: null; error: SupabaseLikeError | null }> => {
      const response = await requestJson(this.context, "/auth/password-reset/confirm", {
        method: "POST",
        bodyJson: payload,
      });

      if (response.error) {
        return {
          data: null,
          error: toError(getErrorMessage(response.error, "Password reset failed")),
        };
      }

      return { data: null, error: null };
    },

    exchangeCodeForSession: async (
      code: string,
    ): Promise<{ data: null; error: SupabaseLikeError | null }> => {
      const response = await requestJson(this.context, "/auth/exchange", {
        method: "POST",
        bodyJson: { code },
      });

      if (response.error) {
        return {
          data: null,
          error: toError(getErrorMessage(response.error, "Code exchange failed")),
        };
      }

      return { data: null, error: null };
    },

    getClaims: async (): Promise<{
      data: { claims: Record<string, unknown> | null };
      error: SupabaseLikeError | null;
    }> => {
      const { data, error } = await this.auth.getUser();
      if (error || !data.user) {
        return { data: { claims: null }, error };
      }

      return {
        data: {
          claims: {
            sub: data.user.id,
            email: data.user.email,
          },
        },
        error: null,
      };
    },
  };
}

export function createCode01Client(context: RequestContext = {}) {
  return new Code01Client(context);
}
