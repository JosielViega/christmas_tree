export type GiftDraftStatus = 'draft' | 'paid' | 'published' | 'cancelled' | 'expired';

export interface GiftDraftData {
  public_id: string;
  sender_name: string;
  gift_style: string;
  composition_mode: string;
  status: GiftDraftStatus;
  created_at: string;
  expires_at: string;
}

export interface GiftDraftAccess {
  gift: GiftDraftData;
  created: boolean;
  access_token?: string;
}

export class GiftDraftApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string, public readonly fields: Record<string, string[]> = {}) {
    super(message);
  }
}

export const createGiftIdempotencyKey = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(input, init);
  } catch {
    throw new GiftDraftApiError('Não foi possível conectar ao servidor.', 0, 'network_error');
  }
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const body = await response.text();
  let payload: { data?: T; error?: { code?: string; message?: string; fields?: Record<string, string[]> } };
  try {
    payload = JSON.parse(body);
  } catch {
    throw new GiftDraftApiError('O servidor retornou uma resposta inválida.', response.status, 'invalid_response');
  }
  if (!response.ok || payload.data === undefined) {
    throw new GiftDraftApiError(
      payload.error?.message ?? 'Não foi possível preparar o presente.',
      response.status,
      payload.error?.code ?? 'http_error',
      payload.error?.fields,
    );
  }
  return payload.data;
};

export const prepareGiftDraft = async (
  treePublicId: string,
  values: { senderName: string; style: string; mode: string; message: string; texture: Blob },
  csrfToken: string,
  idempotencyKey: string,
): Promise<GiftDraftAccess> => {
  const body = new FormData();
  body.set('sender_name', values.senderName);
  body.set('gift_style', values.style);
  body.set('composition_mode', values.mode);
  body.set('message', values.message);
  body.set('publication_consent', 'accepted');
  body.set('texture', values.texture, 'gift-texture.png');
  const response = await request(`/api/trees/${encodeURIComponent(treePublicId)}/gift-drafts`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken, 'Idempotency-Key': idempotencyKey },
    body,
  });
  return parseResponse<GiftDraftAccess>(response);
};

export const fetchGiftDraft = async (giftPublicId: string, accessToken: string): Promise<{ gift: GiftDraftData }> => {
  const response = await request(`/api/gift-drafts/${encodeURIComponent(giftPublicId)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'X-Gift-Draft-Token': accessToken },
  });
  return parseResponse(response);
};

export const cancelGiftDraft = async (giftPublicId: string, accessToken: string, csrfToken: string): Promise<{ gift: GiftDraftData }> => {
  const response = await request(`/api/gift-drafts/${encodeURIComponent(giftPublicId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken, 'X-Gift-Draft-Token': accessToken },
  });
  return parseResponse(response);
};
