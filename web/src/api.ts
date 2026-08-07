import type {
  CheckinResult,
  EventDetail,
  EventSummary,
  IssuedCert,
  Ledger,
  VerifyResult,
  WalletStatus,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...init, headers });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  status: () => request<WalletStatus>('/api/status'),

  ledger: () => request<Ledger>('/api/ledger'),

  listEvents: () => request<{ ok: boolean; sequence: string; events: EventSummary[]; certificates: string[] }>('/api/events'),

  eventDetail: (eventId: string) => request<{ ok: boolean; event: EventDetail }>(`/api/events/${eventId}`),

  createEvent: (input: { name: string; threshold: string; capacity: string }) =>
    request<{ ok: boolean; eventId: string; name: string; threshold: string; capacity: number }>('/api/events', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  checkin: (eventId: string) =>
    request<CheckinResult>('/api/checkin', {
      method: 'POST',
      body: JSON.stringify({ eventId }),
    }),

  issueCertificate: (eventId: string, attendeeId?: string) =>
    request<{ ok: boolean; issued: IssuedCert[]; skipped: { attendeeId: string; reason: string }[] }>('/api/certificate', {
      method: 'POST',
      body: JSON.stringify({ eventId, attendeeId }),
    }),

  verify: (certificateId: string) =>
    request<VerifyResult>(`/api/verify?certificateId=${encodeURIComponent(certificateId)}`),

  insights: (eventId: string) =>
    request<{ ok: boolean; insights: EventDetail['insights'] }>(`/api/insights?eventId=${encodeURIComponent(eventId)}`),
};
