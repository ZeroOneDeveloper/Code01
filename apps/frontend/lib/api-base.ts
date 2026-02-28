const DEFAULT_API_BASE = "http://localhost:3001";
const PRODUCTION_WEB_HOST = "code01.kr";
const PRODUCTION_API_BASE = "https://api.code01.kr";

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

const trimSlash = (value: string) => value.replace(/\/+$/, "");

function resolveFromBrowserHost(): string {
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const host = window.location.hostname.toLowerCase();

  if (host === PRODUCTION_WEB_HOST || host.endsWith(`.${PRODUCTION_WEB_HOST}`)) {
    return PRODUCTION_API_BASE;
  }

  if (host === "localhost" || host === "127.0.0.1" || IPV4_REGEX.test(host)) {
    return `${protocol}//${host}:3001`;
  }

  return `${protocol}//${host}:3001`;
}

export function getClientApiBaseUrl(
  envBase = process.env.NEXT_PUBLIC_API_URL,
): string {
  if (typeof window !== "undefined") {
    return resolveFromBrowserHost();
  }
  if (envBase && envBase.trim()) {
    return trimSlash(envBase.trim());
  }
  return DEFAULT_API_BASE;
}

export function getServerApiBaseUrl(): string {
  const internalApiUrl = process.env.INTERNAL_API_URL;
  if (internalApiUrl && internalApiUrl.trim()) {
    return trimSlash(internalApiUrl.trim());
  }

  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (publicApiUrl && publicApiUrl.trim()) {
    return trimSlash(publicApiUrl.trim());
  }

  return DEFAULT_API_BASE;
}
