import { useTenantStore } from '../stores/tenantStore';

const DEFAULT_TIMEOUT_MS = 10_000;

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function readTenant() {
  const { uuid, backendUrl } = useTenantStore.getState();
  return { uuid, backendUrl };
}

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}/api/v1${trimmedPath}`;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { uuid, backendUrl } = readTenant();
  if (!backendUrl) {
    throw new HttpError('Backend URL is not configured', 0);
  }
  if (!uuid) {
    throw new HttpError('Tenant UUID is not initialized', 0);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // Caller-supplied signal cancels too.
  const onUserAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onUserAbort);

  try {
    const res = await fetch(joinUrl(backendUrl, path), {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Tenant-UUID': uuid,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      throw new HttpError(
        `HTTP ${res.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
        res.status,
        parsed,
      );
    }

    return parsed as T;
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onUserAbort);
  }
}
