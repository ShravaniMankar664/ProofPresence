import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import { api } from '../api';
import type { EventDetail, EventSummary } from '../types';
import { InsightsPanel } from '../components/InsightsPanel';
import { CountUp } from '../components/CountUp';
import { Ring } from '../components/Ring';
import { QRButton } from '../components/QR';
import { CopyButton } from '../components/Toasts';
import {
  CalendarIcon,
  CertIcon,
  ChevronIcon,
  PlusIcon,
  QrIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
} from '../components/icons';

function checkinQrPayload(eventId: string) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/attend?event=${eventId}`;
}

export function OrganizerPage() {
  const { events, eventsLoading, refresh, pushToast } = useApp();

  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState('1');
  const [capacity, setCapacity] = useState('');
  const [creating, setCreating] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuingAttendee, setIssuingAttendee] = useState<string | null>(null);

  const totals = useMemo(() => {
    const attendance = events?.reduce((a, e) => a + Number(e.attendance ?? 0), 0) ?? 0;
    const certs = events?.reduce((a, e) => a + (e.certificateCount ?? 0), 0) ?? 0;
    const engagement = events?.length
      ? Math.round(events.reduce((a, e) => a + (e.insights?.engagementScore ?? 0), 0) / events.length)
      : 0;
    return { events: events?.length ?? 0, attendance, certs, engagement };
  }, [events]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.createEvent({ name, threshold: threshold || '1', capacity: capacity || '0' });
      pushToast(`Event "${res.name}" created on-chain`, 'success');
      setName('');
      setThreshold('1');
      setCapacity('');
      await refresh();
    } catch (err: any) {
      pushToast(err?.message ?? 'Failed to create event', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function toggleDetail(eventId: string) {
    if (expandedId === eventId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(eventId);
    setDetailLoading(true);
    try {
      const res = await api.eventDetail(eventId);
      setDetail(res.event);
    } catch (err: any) {
      pushToast(err?.message ?? 'Failed to load event details', 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  async function issueForAll(eventId: string) {
    setIssuing(true);
    try {
      const res = await api.issueCertificate(eventId);
      if (res.issued.length > 0) {
        pushToast(`${res.issued.length} certificate${res.issued.length === 1 ? '' : 's'} issued on-chain`, 'success');
      } else if (res.skipped[0]) {
        pushToast(`No certificates issued: ${res.skipped[0].reason}`, 'info');
      }
      await refresh();
      if (expandedId === eventId) {
        const d = await api.eventDetail(eventId);
        setDetail(d.event);
      }
    } catch (err: any) {
      pushToast(err?.message ?? 'Failed to issue certificates', 'error');
    } finally {
      setIssuing(false);
    }
  }

  async function issueForAttendee(eventId: string, attendeeId: string) {
    setIssuingAttendee(attendeeId);
    try {
      const res = await api.issueCertificate(eventId, attendeeId);
      if (res.issued[0]) {
        pushToast(`Certificate issued for ${attendeeId.slice(0, 12)}…`, 'success');
      } else if (res.skipped[0]) {
        pushToast(`Certificate not issued: ${res.skipped[0].reason}`, 'info');
      }
      await refresh();
      const d = await api.eventDetail(eventId);
      setDetail(d.event);
    } catch (err: any) {
      pushToast(err?.message ?? 'Failed to issue certificate', 'error');
    } finally {
      setIssuingAttendee(null);
    }
  }

  return (
    <div className="container page">
      <div className="row between wrap" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="section-title">
            Organizer <span className="grad-text">dashboard</span>
          </h1>
          <p className="section-sub">Create events, watch live attendance, and mint verifiable certificates.</p>
        </div>
        <span className="row" style={{ gap: 10 }}>
          <span className="live-dot" />
          <span className="badge badge-cyan">live on-chain data</span>
        </span>
      </div>

      <div className="stats-grid mt-3">
        <StatCard label="Events" value={totals.events} icon={<CalendarIcon size={20} />} glow="rgba(109,93,246,0.4)" />
        <StatCard label="Total check-ins" value={totals.attendance} icon={<UsersIcon size={20} />} glow="rgba(34,211,238,0.4)" />
        <StatCard label="Certificates" value={totals.certs} icon={<CertIcon size={20} />} glow="rgba(52,211,153,0.4)" />
        <StatCard label="Avg. engagement" value={totals.engagement} suffix="%" icon={<SparklesIcon size={20} />} glow="rgba(251,191,36,0.4)" />
      </div>

      <div className="grid-2" style={{ display: 'grid', gap: 18, marginTop: 26, alignItems: 'start' }}>
        {/* Create event */}
        <div className="card" style={{ padding: 26 }}>
          <h2 className="card-title">
            <PlusIcon size={18} /> Create an event
          </h2>
          <p className="card-sub">The event, date and threshold are committed to the Midnight ledger.</p>
          <form onSubmit={onCreate} className="mt-2">
            <div className="field">
              <label>Event name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hackathon Demo 2026" required />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Threshold (min attendees to certify)</label>
                <input className="input" type="number" min={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} required />
              </div>
              <div className="field">
                <label>Expected attendance (optional)</label>
                <input className="input" type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 120" />
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={creating}>
              {creating ? <span className="spinner" /> : <ZapIcon size={16} />}
              {creating ? 'Publishing to Midnight…' : 'Create event on-chain'}
            </button>
          </form>
        </div>

        {/* Quick tips */}
        <div className="card" style={{ padding: 26, borderColor: 'rgba(34,211,238,0.3)' }}>
          <h2 className="card-title">
            <QrIcon size={18} /> Run a live demo
          </h2>
          <div className="stack mt-2">
            <Tip>
              <b>1.</b> Create an event and open its <b>check-in QR</b> on a big screen.
            </Tip>
            <Tip>
              <b>2.</b> Attendees scan the QR with the <b>attendee app</b> — each scan mints a fresh pseudonymous identity.
            </Tip>
            <Tip>
              <b>3.</b> Watch attendance climb in real time, then <b>issue certificates</b> once the threshold is met.
            </Tip>
            <Tip>
              <b>4.</b> Certificates are on-chain — verify any of them from the <b>Verify</b> page.
            </Tip>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="row between" style={{ marginTop: 40, marginBottom: 16 }}>
        <h2 style={{ fontSize: 22 }}>
          Your events <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>({totals.events})</span>
        </h2>
        <button className="btn btn-ghost btn-sm" onClick={refresh}>
          Refresh
        </button>
      </div>

      {eventsLoading && (
        <div className="loading-block">
          <div className="spinner spinner-lg" />
          Loading ledger state…
        </div>
      )}

      {!eventsLoading && (!events || events.length === 0) && (
        <div className="card empty">
          <div className="empty-icon">🎪</div>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>No events yet</h3>
          <p>Create your first event to start collecting attendance.</p>
        </div>
      )}

      <div className="stack">
        {events?.map((ev) => (
          <EventCard
            key={ev.id}
            ev={ev}
            expanded={expandedId === ev.id}
            onToggle={() => toggleDetail(ev.id)}
            detail={expandedId === ev.id ? detail : null}
            detailLoading={detailLoading && expandedId === ev.id}
            issuing={issuing}
            issuingAttendee={issuingAttendee}
            onIssueAll={() => issueForAll(ev.id)}
            onIssueAttendee={(attendeeId) => issueForAttendee(ev.id, attendeeId)}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix = '', icon, glow }: { label: string; value: number; suffix?: string; icon: React.ReactNode; glow: string }) {
  return (
    <div className="card stat" style={{ ['--glow' as any]: glow }}>
      {icon}
      <div className="value">
        <CountUp value={value} suffix={suffix} />
      </div>
      <div className="label" style={{ marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{children}</div>;
}

function EventCard({
  ev,
  expanded,
  onToggle,
  detail,
  detailLoading,
  issuing,
  issuingAttendee,
  onIssueAll,
  onIssueAttendee,
}: {
  ev: EventSummary;
  expanded: boolean;
  onToggle: () => void;
  detail: EventDetail | null;
  detailLoading: boolean;
  issuing: boolean;
  issuingAttendee: string | null;
  onIssueAll: () => void;
  onIssueAttendee: (attendeeId: string) => void;
}) {
  const attendance = Number(ev.attendance ?? 0);
  const threshold = Number(ev.threshold ?? 1);
  const capacity = ev.capacity ?? 0;
  const progressTarget = capacity > 0 ? capacity : threshold;
  const progressPct = Math.min(100, Math.round((attendance / Math.max(1, progressTarget)) * 100));
  const thresholdMet = attendance >= threshold;
  const capacityLabel = capacity > 0 ? `of ~${capacity} expected` : `threshold ${threshold}`;
  const date = new Date(Number(ev.date) * 1000);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="row between wrap" style={{ padding: '22px 24px', gap: 16 }}>
        <div className="row" style={{ gap: 16, minWidth: 220 }}>
          <div
            className="feature-icon"
            style={{
              margin: 0,
              background: thresholdMet ? 'rgba(52,211,153,0.14)' : 'var(--grad-soft)',
              borderColor: thresholdMet ? 'rgba(52,211,153,0.4)' : undefined,
            }}
          >
            {thresholdMet ? <CertIcon /> : <CalendarIcon />}
          </div>
          <div>
            <div className="row wrap" style={{ gap: 8 }}>
              <h3 style={{ fontSize: 17 }}>{ev.name}</h3>
              {thresholdMet ? <span className="badge badge-green">threshold met</span> : <span className="badge">threshold {threshold}</span>}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
              {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 20 }}>
          <div style={{ width: 160 }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {capacityLabel}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                <CountUp value={attendance} /> <span className="muted" style={{ fontWeight: 400 }}>/ {progressTarget}</span>
              </span>
            </div>
            <div className="progress">
              <div className={`progress-fill ${thresholdMet ? '' : 'warn'}`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <Ring value={ev.insights?.engagementScore ?? 0} size={62} stroke={6} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <QRButton text={checkinQrPayload(ev.id)} title={`${ev.name} — check-in QR`} label="Check-in QR" />
            <button className={`btn btn-ghost btn-sm ${expanded ? 'btn-cyan' : ''}`} onClick={onToggle}>
              <ChevronIcon size={14} /> {expanded ? 'Hide details' : 'Details & insights'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: 24 }}>
          {detailLoading ? (
            <div className="loading-block">
              <div className="spinner spinner-lg" />
              Loading on-chain details…
            </div>
          ) : detail ? (
            <>
                <div className="row between wrap" style={{ marginBottom: 20, gap: 10 }}>
                  <div className="row" style={{ gap: 12 }}>
                    <CopyButton text={detail.id} label="Copy event ID" />
                    <QRButton text={checkinQrPayload(detail.id)} title={`${detail.name} — check-in QR`} label="Check-in QR" />
                  </div>
                  {thresholdMet ? (
                    <button className="btn btn-primary btn-sm" onClick={onIssueAll} disabled={issuing}>
                      {issuing ? <span className="spinner" /> : <CertIcon size={15} />}
                      {issuing ? 'Issuing…' : 'Issue certificates for all attendees'}
                    </button>
                  ) : (
                    <span className="badge badge-amber">
                      certificates unlock at {threshold} attendance ({attendance}/{threshold})
                    </span>
                  )}
                </div>

              <InsightsPanel insights={detail.insights} />

              <h3 className="card-title mt-3" style={{ marginBottom: 12 }}>
                <UsersIcon size={17} /> Attendees ({detail.attendees.length})
              </h3>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Pseudonymous identity</th>
                      <th>Checked in</th>
                      <th>Certificate</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.attendees.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 22 }}>
                          No attendees yet — share the check-in QR!
                        </td>
                      </tr>
                    )}
                    {detail.attendees.map((a) => (
                      <tr key={a.attendeeId}>
                        <td>
                          <span className="hash">{a.attendeeId.slice(0, 18)}…</span>
                        </td>
                        <td>
                          <span className="muted" style={{ fontSize: 12.5 }}>
                            {new Date(a.checkedInAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td>
                          {a.hasCertificate ? (
                            <span className="badge badge-green">issued</span>
                          ) : thresholdMet ? (
                            <span className="badge badge-amber">ready</span>
                          ) : (
                            <span className="badge">waiting</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {!a.hasCertificate && thresholdMet && (
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={issuingAttendee === a.attendeeId}
                              onClick={() => onIssueAttendee(a.attendeeId)}
                            >
                              {issuingAttendee === a.attendeeId ? <span className="spinner" /> : 'Issue'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
