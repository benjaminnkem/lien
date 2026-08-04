const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

type ApiErrorPayload = {
  code?: string;
  message?: string | string[];
  [key: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload?: ApiErrorPayload;

  constructor(message: string, status: number, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code;
    this.payload = payload;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let payload: ApiErrorPayload | undefined;

  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    payload = undefined;
  }

  const rawMessage = payload?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(". ")
    : rawMessage || `API ${res.status}: ${res.statusText}`;

  return new ApiError(message, res.status, payload);
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  return apiRequest<TResponse>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getApiErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function getAuditExportUrl(
  format: "csv" | "json",
  fingerprint?: string,
) {
  const search = new URLSearchParams({ format, limit: "200" });
  if (fingerprint) search.set("fingerprint", fingerprint);
  return `${API_BASE}/assets/audit/export?${search.toString()}`;
}

export { API_BASE };
