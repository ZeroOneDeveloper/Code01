const DEFAULT_API_BASE = "http://localhost:3001";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE;
}

export type QuizEntryQuiz = {
  id: number;
  organization_id: number;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  published_at?: string | null;
  assignment_mode?: "one_for_all" | "one_per_attempt" | "all" | string | null;
  problem_count?: number | null;
  global_problem_id?: number | null;
};

export type QuizEntryPoolItem = {
  problem_id: number;
  title: string | null;
  order_index: number;
};

export type QuizEntryContext = {
  viewer_user_id: string;
  quiz: QuizEntryQuiz;
  status: "upcoming" | "active" | "ended" | string;
  server_now: string | null;
  attempt_started_at?: string | null;
  pool: QuizEntryPoolItem[];
  submission_summary_by_problem?: Record<
    string,
    {
      submitted: boolean;
      submission_count: number;
      latest_submission_id: number | null;
      latest_status_code: number | null;
      latest_is_correct: boolean | null;
      latest_submitted_at: string | null;
    }
  >;
};

type QuizEntryFetchResult =
  | {
      ok: true;
      data: QuizEntryContext;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as
      | { detail?: string; error?: { message?: string } | string }
      | null;
    if (!payload) return `요청 실패 (${response.status})`;
    if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    if (
      payload.error &&
      typeof payload.error === "object" &&
      typeof payload.error.message === "string" &&
      payload.error.message.trim()
    ) {
      return payload.error.message;
    }
  } catch {
    // ignore parse errors
  }
  return `요청 실패 (${response.status})`;
}

export async function fetchQuizEntryContext(
  organizationId: string,
  quizId: string,
): Promise<QuizEntryFetchResult> {
  const orgId = Number(organizationId);
  const quizIdNum = Number(quizId);
  if (!Number.isFinite(orgId) || !Number.isFinite(quizIdNum)) {
    return {
      ok: false,
      status: 400,
      message: "잘못된 퀴즈 경로입니다.",
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/data/quizzes/${orgId}/${quizIdNum}/entry-context`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: await parseErrorMessage(response),
      };
    }

    const payload = (await response.json()) as QuizEntryContext;
    return { ok: true, data: payload };
  } catch {
    return {
      ok: false,
      status: 0,
      message: "퀴즈 입장 정보를 불러오지 못했습니다.",
    };
  }
}
