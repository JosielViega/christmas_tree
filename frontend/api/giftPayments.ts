import { GiftDraftApiError, createGiftIdempotencyKey } from './giftDrafts';

export interface GiftProduct {
  code: string;
  name: string;
  amount_cents: number;
  currency: string;
}

export type GiftOrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded' | 'failed';

export interface GiftPaymentOrder {
  public_id: string;
  product_code: string;
  product_name: string;
  amount_cents: number;
  currency: string;
  status: GiftOrderStatus;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_ticket_url: string | null;
  expires_at: string;
  paid_at: string | null;
  publication_status: 'draft' | 'paid' | 'published' | 'cancelled' | 'expired' | null;
}

const request = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  } catch {
    throw new GiftDraftApiError('Não foi possível conectar ao servidor.', 0, 'network_error');
  }
  const body = await response.text();
  let payload: { data?: T; error?: { code?: string; message?: string; fields?: Record<string, string[]> } };
  try {
    payload = JSON.parse(body);
  } catch {
    throw new GiftDraftApiError('O servidor retornou uma resposta inválida.', response.status, 'invalid_response');
  }
  if (!response.ok || payload.data === undefined) {
    throw new GiftDraftApiError(payload.error?.message ?? 'Não foi possível consultar o pagamento.', response.status, payload.error?.code ?? 'http_error', payload.error?.fields);
  }
  return payload.data;
};

export const fetchGiftCatalog = (): Promise<{ available: boolean; products: GiftProduct[]; technical_environment: boolean }> =>
  request('/api/payments/catalog', { headers: { Accept: 'application/json' } });

export const createGiftPaymentOrder = (
  giftPublicId: string,
  accessToken: string,
  csrfToken: string,
  productCode: string,
  payerEmail: string,
  idempotencyKey: string = createGiftIdempotencyKey(),
): Promise<{ order: GiftPaymentOrder }> => {
  const body = new URLSearchParams({ product_code: productCode, payer_email: payerEmail });
  return request(`/api/gift-drafts/${encodeURIComponent(giftPublicId)}/order`, {
    method: 'POST',
    headers: {
      Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-Token': csrfToken, 'X-Gift-Draft-Token': accessToken, 'Idempotency-Key': idempotencyKey,
    },
    body,
  });
};

export const fetchGiftPaymentOrder = (giftPublicId: string, accessToken: string): Promise<{ order: GiftPaymentOrder }> =>
  request(`/api/gift-drafts/${encodeURIComponent(giftPublicId)}/order`, {
    headers: { Accept: 'application/json', 'X-Gift-Draft-Token': accessToken },
  });
