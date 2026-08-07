import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../store';
import { api } from '../api';
import type { EventSummary } from '../types';
import { Scanner } from '../components/Scanner';
import { QRButton } from '../components/QR';
import { CountUp } from '../components/CountUp';
import { CopyButton } from '../components/Toasts';
import {
  CertIcon,
  ChevronIcon,
  ClockIcon,
  FingerprintIcon,
  ScanIcon,
  ShieldIcon,
  ZapIcon,
} from '../components/icons';

function extractEventId(data: string): string | null {
  const trimmed = data.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  try {
    const url = new URL(trimmed);
    const ev = url.searchParams.get('event');
    if (ev && /^[0-9a-f]{64}$/i.test(ev)) return ev.toLowerCase();
    const pathMatch = trimmed.match(/[0-9a-f]{64}/i);
    return pathMatch ? pathMatch[0].toLowerCase() : null;
  } catch {
    const pathMatch = trimmed.match(/[0-9a-f]{64}/i);
    return pathMatch ? pathMatch[0].toLowerCase() : null;
  }
}

function certVerifyPayload(certificateId: string) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/verify?cert=${certificateId}`;
}

export function AttendeePage() {
  const { events, eventsLoading, refresh, pushToast, myAttendeeId, setMyAttendeeId, myCertificates, setMyCertificate } = useApp();
  const [params, setSearchParams] = useSearchParams();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualId, setManualId] = useState('');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [certs, setCerts] = useState<{ eventId: string; certificateId: string; valid: boolean | null }[]>([]);

  const myEvents = useMemo(() => {
    const list = (events ?? []).map((ev) => ({ ev, attendeeId: myAttendeeId(ev.id) }));
    return list;
  }, [events, myAttendeeId]);

  const claimedEvents = useMemo(() => new Set(myCertificates().map((c) => c.eventId)), [myCertificates]);

  const loadCerts = useCallback(async () => {
    const mine = myCertificates();
    const verified = await Promise.all(
      mine.map(async (c) => {
        try {
          const res = await api.verify(c.certificateId);
          return { ...c, valid: res.valid };
        } catch {
          return { ...c, valid: null };
        }
      }),
    );
    setCerts(verified);
  }, [myCertificates]);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  // Deep link: ?event=<hex> (from a scanned QR opened in a browser).
  // Runs once; the query param is cleared so a reload doesn't check in twice.
  useEffect(() => {
    const ev = params.get('event');
    if (ev && /^[0-9a-f]{64}$/i.test(ev)) {
      const id = ev.toLowerCase();
      if (myAttendeeId(id)) {
        pushToast('You are already checked in to this event', 'info');
      } else {
        void doCheckin(id);
      }
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doCheckin(eventId: string) {
    if (checkingIn) return;
    setCheckingIn(eventId);
    try {
      const res = await api.checkin(eventId);
      setMyAttendeeId(eventId, res.attendeeId);
      pushToast('Checked in — welcome to the event!', 'success');
      await refresh();
    } catch (err: any) {
      const msg = err?.message ?? 'Check-in failed';
      if (/Already checked in/.test(msg)) {
        pushToast('You are already checked in to this event', 'info');
      } else if (/does not exist|not found/i.test(msg)) {
        pushToast('This event does not exist on-chain', 'error');
      } else {
        pushToast(msg, 'error');
      }
    } finally {
      setCheckingIn(null);
      setScannerOpen(false);
    }
  }

  function onScan(data: string) {
    const eventId = extractEventId(data);
    if (!eventId) {
      pushToast('QR does not look like a ProofPresence check-in', 'error');
      return;
    }
    void doCheckin(eventId);
  }

  async function claim(eventId: string, attendeeId: string) {
    setClaiming(eventId);
    try {
      const res = await api.issueCertificate(eventId, attendeeId);
      const cert = res.issued[0];
      if (cert) {
        setMyCertificate(eventId, cert.certificateId);
        pushToast('Certificate claimed and stored on-chain!', 'success');
        await loadCerts();
        await refresh();
      } else if (res.skipped[0]) {
        pushToast(`Certificate not issued: ${res.skipped[0].reason}`, 'info');
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to claim certificate';
      if (/threshold not met/i.test(msg)) {
        pushToast('Certificate not ready — attendance threshold not met yet', 'error');
      } else if (/already issued/i.test(msg)) {
        pushToast('You already have a certificate for this event', 'info');
      } else {
        pushToast(msg, 'error');
      }
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="container page">
      <div className="row between wrap" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="section-title">
            Attendee <span className="grad-text">dashboard</span>
          </h1>
          <p className="section-sub">
            Scan a check-in QR or pick an event. Your identity stays pseudonymous — nothing about you is revealed on-chain.
          </p>
        </div>
        <span className="row" style={{ gap: 10 }}>
          <FingerprintIcon size={16} />
          <span className="badge badge-violet">fresh identity per event</span>
        </span>
      </div>

      {/* Check-in */}
      <div className="card card-glow mt-3" style={{ padding: 26 }}>
        <div className="row between wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 14 }}>
            <div className="feature-icon" style={{ margin: 0 }}>
              <ScanIcon />
            </div>
            <div>
              <h2 className="card-title">Check in to an event</h2>
              <p className="card-sub">Point your camera at an organizer's QR code, or paste an event ID.</p>
            </div>
          </div>
          <button className="btn btn-cyan" onClick={() => setScannerOpen((v) => !v)}>
            {scannerOpen ? 'Close scanner' : (
              <>
                <ScanIcon size={17} /> Scan QR code
              </>
            )}
          </button>
        </div>

        {scannerOpen && (
          <div className="mt-3">
            <Scanner onScan={onScan} onClose={() => setScannerOpen(false)} />
          </div>
        )}

        <div className="row mt-2" style={{ gap: 10 }}>
          <input
            className="input mono"
            style={{ flex: 1 }}
            placeholder="Paste event ID (64 hex chars)…"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            spellCheck={false}
          />
          <button className="btn btn-ghost" disabled={!manualId || !!checkingIn} onClick={() => manualId.trim() && void doCheckin(manualId.trim())}>
            {checkingIn ? <span className="spinner" /> : <ZapIcon size={16} />} Check in
          </button>
        </div>
      </div>

      {/* Events to join */}
      <div className="row between" style={{ marginTop: 40, marginBottom: 16 }}>
        <h2 style={{ fontSize: 22 }}>Open events</h2>
        <button className="btn btn-ghost btn-sm" onClick={refresh}>
          Refresh
        </button>
      </div>

      {eventsLoading && (
        <div className="loading-block">
          <div className="spinner spinner-lg" />
          Loading events from the ledger…
        </div>
      )}

      {!eventsLoading && (!events || events.length === 0) && (
        <div className="card empty">
          <div className="empty-icon">🎫</div>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>No events on-chain yet</h3>
          <p>Ask an organizer to create an event, then check in here.</p>
        </div>
      )}

      <div className="stack">
        {myEvents.map(({ ev, attendeeId }) => (
          <JoinRow
            key={ev.id}
            ev={ev}
            attendeeId={attendeeId}
            claimed={claimedEvents.has(ev.id)}
            checkingIn={checkingIn === ev.id}
            claiming={claiming === ev.id}
            onCheckin={() => void doCheckin(ev.id)}
            onClaim={() => attendeeId && void claim(ev.id, attendeeId)}
          />
        ))}
      </div>

      {/* My certificates */}
      <div className="row between" style={{ marginTop: 44, marginBottom: 16 }}>
        <h2 style={{ fontSize: 22 }}>
          My certificates <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>({certs.length})</span>
        </h2>
      </div>

      {certs.length === 0 ? (
        <div className="card empty" style={{ padding: 30 }}>
          <div className="empty-icon">📜</div>
          <p style={{ margin: 0 }}>
            No certificates yet. Check in to an event and claim your certificate once the attendance threshold is met.
          </p>
        </div>
      ) : (
        <div className="grid grid-2">
          {certs.map((c) => (
            <div className="card" key={c.certificateId} style={{ padding: 20 }}>
              <div className="row between wrap" style={{ gap: 12 }}>
                <div className="row" style={{ gap: 12 }}>
                  <div className="feature-icon" style={{ margin: 0, background: 'rgba(52,211,153,0.14)', borderColor: 'rgba(52,211,153,0.4)' }}>
                    <CertIcon />
                  </div>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="card-title" style={{ fontSize: 15 }}>
                        {events?.find((e) => e.id === c.eventId)?.name ?? 'Event'}
                      </span>
                      {c.valid === true ? (
                        <span className="badge badge-green">verified on-chain</span>
                      ) : c.valid === false ? (
                        <span className="badge badge-red">not found</span>
                      ) : (
                        <span className="badge">verifying…</span>
                      )}
                    </div>
                    <div className="hash" style={{ marginTop: 4 }}>{c.certificateId.slice(0, 22)}…</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <QRButton text={certVerifyPayload(c.certificateId)} title="Certificate — verify QR" label="QR" />
                  <Link to={`/verify?cert=${c.certificateId}`} className="btn btn-ghost btn-sm">
                    <ShieldIcon size={14} /> Verify
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JoinRow({
  ev,
  attendeeId,
  claimed,
  checkingIn,
  claiming,
  onCheckin,
  onClaim,
}: {
  ev: EventSummary;
  attendeeId: string | null;
  claimed: boolean;
  checkingIn: boolean;
  claiming: boolean;
  onCheckin: () => void;
  onClaim: () => void;
}) {
  const attendance = Number(ev.attendance ?? 0);
  const threshold = Number(ev.threshold ?? 1);
  const thresholdMet = attendance >= threshold;
  const [showIdentity, setShowIdentity] = useState(false);
  const date = new Date(Number(ev.date) * 1000);
  const progressPct = Math.min(100, Math.round((attendance / Math.max(1, threshold)) * 100));

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div className="row between wrap" style={{ gap: 14 }}>
        <div style={{ minWidth: 210, flex: 1 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 16.5 }}>{ev.name}</h3>
            {attendeeId ? <span className="badge badge-green">✓ you're checked in</span> : <span className="badge">open</span>}
            {thresholdMet && !attendeeId && <span className="badge badge-cyan">threshold met</span>}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 5 }}>
            {date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · threshold {threshold}
          </div>
        </div>

        <div style={{ width: 170 }}>
          <div className="row between" style={{ marginBottom: 5 }}>
            <span className="muted" style={{ fontSize: 12 }}>attendance</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              <CountUp value={attendance} /> <span className="muted" style={{ fontWeight: 400 }}>/ {threshold}</span>
            </span>
          </div>
          <div className="progress">
            <div className={`progress-fill ${thresholdMet ? '' : 'warn'}`} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          {!attendeeId ? (
            <button className="btn btn-cyan" disabled={checkingIn} onClick={onCheckin}>
              {checkingIn ? <span className="spinner" /> : <ZapIcon size={15} />} Check in
            </button>
          ) : claimed ? (
            <span className="badge badge-green">
              <CertIcon size={12} /> certificate claimed
            </span>
          ) : thresholdMet ? (
            <button className="btn btn-primary" disabled={claiming} onClick={onClaim}>
              {claiming ? <span className="spinner" /> : <CertIcon size={15} />} Claim certificate
            </button>
          ) : (
            <span className="badge badge-amber">waiting for threshold</span>
          )}
        </div>
      </div>

      {attendeeId && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 14 }}>
          <div className="row between wrap" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8, flex: 1, minWidth: 220 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>Your pseudonymous identity:</span>
              <span className="hash">{attendeeId.slice(0, 20)}…</span>
              <CopyButton text={attendeeId} />
              <button className="btn btn-ghost btn-sm" onClick={() => setShowIdentity((v) => !v)}>
                <ChevronIcon size={13} /> {showIdentity ? 'Hide' : 'View'}
              </button>
            </div>
            <span className="badge badge-violet">
              <ClockIcon size={12} /> not stored on-chain
            </span>
          </div>
          {showIdentity && (
            <div className="card mt-2" style={{ padding: 14, marginTop: 12 }}>
              <div className="hash" style={{ wordBreak: 'break-all' }}>{attendeeId}</div>
              <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
                This is a zero-knowledge identity derived from a secret generated only on this device for this event. It
                reveals nothing about who you are.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
