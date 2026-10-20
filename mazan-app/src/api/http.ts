/**
 * JSON fetching with a timeout and errors sorted into kinds the UI can explain
 * (no connection, slow server, rate limit, not found …).
 */

export type ApiErrorKind = 'offline' | 'timeout' | 'rateLimit' | 'notFound' | 'server' | 'badResponse';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorKind(e: unknown): ApiErrorKind {
  return e instanceof ApiError ? e.kind : 'offline';
}

/** Open Food Facts asks every app to identify itself. */
export const USER_AGENT = 'Mazan/1.0 (personal iOS app)';

export async function getJson<T>(url: string, opts: { timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json', ...opts.headers }, signal: controller.signal });
  } catch (e) {
    // fetch only rejects for network failures and aborts.
    throw new ApiError(controller.signal.aborted ? 'timeout' : 'offline', String(e));
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new ApiError('rateLimit', `HTTP 429 ${url}`);
  if (res.status === 404) throw new ApiError('notFound', `HTTP 404 ${url}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.ok ? 'badResponse' : 'server', `HTTP ${res.status}, not JSON: ${url}`);
  }
  // api.data.gov reports an exhausted key in the body as well as with 429.
  const err = (body as { error?: { code?: string } } | null)?.error;
  if (err?.code === 'OVER_RATE_LIMIT') throw new ApiError('rateLimit', 'OVER_RATE_LIMIT');
  if (!res.ok) throw new ApiError('server', `HTTP ${res.status} ${url}`);
  return body as T;
}
