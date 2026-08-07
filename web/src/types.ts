export interface Insights {
  attendance: number;
  attendanceRate: number;
  peakCheckinHour: number | null;
  peakCheckinWindow: string | null;
  checkinHistogram: { hour: number; count: number }[];
  onTimeRate: number;
  certCompletion: number;
  engagementScore: number;
  labels: Record<string, string>;
}

export interface EventSummary {
  id: string;
  name: string;
  date: string;
  threshold: string;
  organizer: string;
  attendance: string;
  capacity: number;
  createdAt: number | null;
  attendeeCount: number;
  certificateCount: number;
  insights: Insights;
}

export interface Attendee {
  attendeeId: string;
  checkedInAt: number;
  hasCertificate: boolean;
}

export interface EventDetail {
  id: string;
  name: string;
  date: string;
  threshold: string;
  organizer: string;
  attendance: number;
  certificateOnChain: number;
  capacity: number;
  createdAt: number | null;
  attendees: Attendee[];
  certificateCount: number;
  insights: Insights;
}

export interface WalletStatus {
  ok: boolean;
  network: string;
  contractAddress: string;
  walletAddress: string;
  balance: { tNight: string; dust: string };
  serverTime: number;
}

export interface VerifyResult {
  ok: boolean;
  valid: boolean;
  certificateId: string;
  network: string;
  contractAddress: string;
}

export interface IssuedCert {
  attendeeId: string;
  certificateId: string;
}

export interface CheckinResult {
  ok: boolean;
  attendeeId: string;
  eventId: string;
  message: string;
}

export interface Ledger {
  ok: boolean;
  sequence: string;
  events: EventSummary[];
  certificates: string[];
}
