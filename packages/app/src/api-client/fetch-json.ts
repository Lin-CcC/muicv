type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`响应不是 JSON（status=${response.status}）`);
  }

  return (await response.json()) as T;
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await readJson<JsonValue>(response).catch(() => null);
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `请求失败（status=${response.status}）`;
    throw new Error(message);
  }

  return readJson<T>(response);
}
