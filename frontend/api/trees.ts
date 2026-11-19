import type { ChristmasTreeAccess, ChristmasTreeData } from '../types';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
}

export class TreeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });
  const payload = await response.json() as ApiErrorBody & { data?: T };

  if (!response.ok || payload.data === undefined) {
    throw new TreeApiError(
      payload.error?.message ?? 'Não foi possível concluir a solicitação.',
      response.status,
      payload.error?.code ?? 'request_failed',
      payload.error?.fields ?? {},
    );
  }

  return payload.data;
};

const formRequest = <T>(path: string, values: Record<string, string>, csrfToken: string): Promise<T> => {
  return request<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-Token': csrfToken,
    },
    body: new URLSearchParams(values),
  });
};

export const fetchApiContext = (): Promise<{ csrf_token: string }> => request('/api/context');

export const createTree = (ownerName: string, csrfToken: string): Promise<ChristmasTreeAccess> => {
  return formRequest('/api/trees', { owner_name: ownerName }, csrfToken);
};

export const recoverTree = (
  publicId: string,
  recoveryCode: string,
  csrfToken: string,
): Promise<ChristmasTreeAccess> => {
  return formRequest(
    `/api/trees/${encodeURIComponent(publicId)}/recover`,
    { recovery_code: recoveryCode },
    csrfToken,
  );
};

export const fetchPublicTree = (publicId: string): Promise<{ tree: ChristmasTreeData }> => {
  return request(`/api/trees/${encodeURIComponent(publicId)}`);
};
