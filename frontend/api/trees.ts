import type { ChristmasTreeAccess, ChristmasTreeData, OrnamentCollection, OrnamentType, OwnerMessageCollection, SocialOrnamentData } from '../types';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
    message_count?: number;
    reveal_at?: string;
  };
}

export class TreeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string[]> = {},
    public readonly metadata: { message_count?: number; reveal_at?: string } = {},
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
      { message_count: payload.error?.message_count, reveal_at: payload.error?.reveal_at },
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

export const fetchOrnaments = (publicId: string): Promise<OrnamentCollection> => {
  return request(`/api/trees/${encodeURIComponent(publicId)}/ornaments`);
};

export const createOrnament = (
  publicId: string,
  type: OrnamentType,
  senderName: string,
  message: string,
  csrfToken: string,
  idempotencyKey: string,
): Promise<{ ornament: SocialOrnamentData; created: boolean; capacity: number }> => {
  return request(`/api/trees/${encodeURIComponent(publicId)}/ornaments`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': idempotencyKey,
    },
    body: new URLSearchParams({ ornament_type: type, sender_name: senderName, message }),
  });
};

export const fetchOwnerMessages = (publicId: string): Promise<OwnerMessageCollection> => {
  return request(`/api/trees/${encodeURIComponent(publicId)}/messages`, { cache: 'no-store' });
};

export const deleteOrnament = (
  treePublicId: string,
  ornamentPublicId: string,
  csrfToken: string,
): Promise<{ deleted: true; ornament_public_id: string }> => {
  return request(`/api/trees/${encodeURIComponent(treePublicId)}/ornaments/${encodeURIComponent(ornamentPublicId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'X-CSRF-Token': csrfToken },
  });
};
