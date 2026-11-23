import type { ChristmasTreeAccess, ChristmasTreeData, MemoryCollection, OrnamentCollection, OrnamentType, OwnerMessageCollection, PremiumGiftCollection, SocialOrnamentData, TreeMemoryData } from '../types';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
    message_count?: number;
    reveal_at?: string;
  };
}

type ApiPayload<T> = ApiErrorBody & { data?: T };
const isAbortError = (cause: unknown): boolean => cause instanceof Error && cause.name === 'AbortError';

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
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
    });
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    reportApiFailure(path, 'network_error', 0, cause);
    throw new TreeApiError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.', 0, 'network_error');
  }

  let body: string;
  try {
    body = await response.text();
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    reportApiFailure(path, 'network_error', response.status, cause);
    throw new TreeApiError('A conexão foi interrompida durante a resposta. Tente novamente.', 0, 'network_error');
  }
  let payload: ApiPayload<T>;
  try {
    payload = JSON.parse(body) as ApiPayload<T>;
  } catch (cause) {
    reportApiFailure(path, 'invalid_response', response.status, cause);
    throw new TreeApiError(
      response.ok
        ? 'O servidor retornou uma resposta inválida. Tente novamente.'
        : httpErrorMessage(response.status),
      response.status,
      'invalid_response',
    );
  }

  if (!response.ok || payload.data === undefined) {
    const code = payload.error?.code ?? (response.ok ? 'invalid_response' : 'http_error');
    reportApiFailure(path, code, response.status);
    throw new TreeApiError(
      payload.error?.message ?? (response.ok ? 'O servidor retornou uma resposta inválida. Tente novamente.' : httpErrorMessage(response.status)),
      response.status,
      code,
      payload.error?.fields ?? {},
      { message_count: payload.error?.message_count, reveal_at: payload.error?.reveal_at },
    );
  }

  return payload.data;
};

const httpErrorMessage = (status: number): string => {
  if (status === 419) return 'Sua sessão expirou. Recarregue a página e tente novamente.';
  if (status >= 500) return 'O servidor encontrou um erro interno. Tente novamente mais tarde.';
  return `A solicitação não pôde ser concluída (HTTP ${status}).`;
};

const reportApiFailure = (path: string, code: string, status: number, cause?: unknown): void => {
  if (!import.meta.env.DEV) return;
  console.error('API request failed', {
    path: path.split('?')[0],
    code,
    status,
    cause: cause instanceof Error ? cause.name : undefined,
  });
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

export const fetchApiContext = (signal?: AbortSignal): Promise<{ csrf_token: string }> => request('/api/context', { signal });

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

export const fetchOrnaments = (publicId: string, signal?: AbortSignal): Promise<OrnamentCollection> => {
  return request(`/api/trees/${encodeURIComponent(publicId)}/ornaments`, { signal });
};

export const fetchPremiumGifts = (publicId: string, signal?: AbortSignal): Promise<PremiumGiftCollection> =>
  request(`/api/trees/${encodeURIComponent(publicId)}/gifts`, { signal });

export const fetchMemories = (publicId: string, signal?: AbortSignal): Promise<MemoryCollection> =>
  request(`/api/trees/${encodeURIComponent(publicId)}/memories`, { signal });

const memoryForm = (
  path: string,
  image: File | null,
  caption: string,
  csrfToken: string,
): Promise<{ memory: TreeMemoryData; capacity: number }> => {
  const body = new FormData();
  body.set('caption', caption);
  if (image) body.set('image', image, 'memory.jpg');
  return request(path, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body });
};

export const createMemory = (treePublicId: string, image: File, caption: string, csrfToken: string) =>
  memoryForm(`/api/trees/${encodeURIComponent(treePublicId)}/memories`, image, caption, csrfToken);

export const updateMemory = (treePublicId: string, memoryPublicId: string, image: File | null, caption: string, csrfToken: string) =>
  memoryForm(`/api/trees/${encodeURIComponent(treePublicId)}/memories/${encodeURIComponent(memoryPublicId)}`, image, caption, csrfToken);

export const deleteMemory = (treePublicId: string, memoryPublicId: string, csrfToken: string): Promise<{ deleted: true; memory_public_id: string }> =>
  request(`/api/trees/${encodeURIComponent(treePublicId)}/memories/${encodeURIComponent(memoryPublicId)}`, {
    method: 'DELETE', headers: { 'X-CSRF-Token': csrfToken },
  });

export const hidePremiumGift = (treePublicId: string, giftPublicId: string, csrfToken: string): Promise<{ hidden: true }> =>
  request(`/api/trees/${encodeURIComponent(treePublicId)}/gifts/${encodeURIComponent(giftPublicId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'X-CSRF-Token': csrfToken },
  });

export const createOrnament = (
  publicId: string,
  type: OrnamentType,
  senderName: string,
  message: string,
  csrfToken: string,
  idempotencyKey: string,
): Promise<{ ornament: SocialOrnamentData; created: boolean; capacity: number; current_visitor_has_decorated: boolean }> => {
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
