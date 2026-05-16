import type { CmsPostPayload } from './post-input.ts';

export type CmsPostDocument = CmsPostPayload & {
  id: number | string;
  createdAt?: string;
  updatedAt?: string;
};

type PayloadListResponse<T> = {
  docs?: T[];
};

type PayloadLoginResponse = {
  token?: string;
};

type PayloadErrorResponse = {
  message?: string;
  errors?: Array<{ message?: string }>;
};

type CmsClientOptions = {
  baseUrl?: string;
  token?: string;
  email?: string;
  password?: string;
  fetchImpl?: typeof fetch;
};

export class CmsAuthError extends Error {
  constructor() {
    super('缺少 CMS 鉴权。请设置 MUICV_CMS_TOKEN，或设置 MUICV_CMS_EMAIL / MUICV_CMS_PASSWORD。');
  }
}

export class CmsClient {
  private readonly baseUrl: string;
  private readonly email: string | undefined;
  private readonly password: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private token: string | undefined;

  constructor(options: CmsClientOptions = {}) {
    this.baseUrl = trimTrailingSlash(options.baseUrl ?? process.env.MUICV_CMS_URL ?? 'https://cms.muicv.com');
    this.token = options.token ?? process.env.MUICV_CMS_TOKEN ?? process.env.PAYLOAD_TOKEN;
    this.email = options.email ?? process.env.MUICV_CMS_EMAIL;
    this.password = options.password ?? process.env.MUICV_CMS_PASSWORD;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async findPostBySlug(slug: string): Promise<CmsPostDocument | null> {
    const params = new URLSearchParams({
      depth: '0',
      limit: '1',
      'where[slug][equals]': slug,
    });
    const result = await this.request<PayloadListResponse<CmsPostDocument>>(`/api/posts?${params.toString()}`);
    return result.docs?.[0] ?? null;
  }

  async createPost(payload: CmsPostPayload): Promise<CmsPostDocument> {
    return this.request<CmsPostDocument>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updatePost(id: number | string, payload: CmsPostPayload): Promise<CmsPostDocument> {
    return this.request<CmsPostDocument>(`/api/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const authHeader = await this.getAuthorizationHeader();
    headers.set('Authorization', authHeader);

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const bodyText = await response.text();
    const json = parseJson(bodyText);

    if (!response.ok) {
      throw new Error(`CMS API ${response.status}: ${extractErrorMessage(json)}`);
    }

    return json as T;
  }

  private async getAuthorizationHeader(): Promise<string> {
    if (this.token) {
      return `Bearer ${this.token}`;
    }

    if (!this.email || !this.password) {
      throw new CmsAuthError();
    }

    const response = await this.fetchImpl(`${this.baseUrl}/api/users/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: this.email,
        password: this.password,
      }),
    });

    const bodyText = await response.text();
    const json = parseJson(bodyText);

    if (!response.ok) {
      throw new Error(`CMS 登录失败 ${response.status}: ${extractErrorMessage(json)}`);
    }

    const token = (json as PayloadLoginResponse).token;
    if (!token) {
      throw new Error('CMS 登录成功但没有返回 token。');
    }

    this.token = token;
    return `Bearer ${token}`;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '');
}

function parseJson(value: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractErrorMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return 'unknown error';
  }

  const error = value as PayloadErrorResponse;
  const firstMessage = error.errors?.find((item) => typeof item.message === 'string')?.message;
  return firstMessage ?? error.message ?? JSON.stringify(value);
}
