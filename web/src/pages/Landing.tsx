import { Link } from 'react-router-dom';
import type { ComponentType } from 'react';
import { useApp } from '../store';
import { CountUp } from '../components/CountUp';
import { Reveal } from '../components/Reveal';
import {
  ArrowRightIcon,
  CalendarIcon,
  CertIcon,
  ChartIcon,
  FingerprintIcon,
  GlobeIcon,
  LockIcon,
  QrIcon,
  ScanIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
  ZapIcon,
} from '../components/icons';

const FEATURES = [
  {
    icon: FingerprintIcon,
    title: 'Pseudonymous by design',
    body: 'Every attendee checks in with a zero-knowledge identity derived from their own secret — no names, emails, or personal data ever touch the ledger.',
  },
  {
    icon: LockIcon,
    title: 'Zero-knowledge proofs',
    body: 'Check-ins and certificates are validated by ZK proofs generated off-chain and verified on Midnight. Privacy is preserved, integrity is guaranteed.',
  },
  {
    icon: CertIcon,
    title: 'Verifiable certificates',
    body: 'Attendance certificates are commitments stored on-chain. Anyone can verify a certificate without contacting the organizer.',
  },
  {
    icon: QrIcon,
    title: 'QR check-in & scanning',
    body: 'Organizers display a check-in QR, attendees scan with their phone. No manual entry, no data forms — just point, scan, done.',
  },
  {
    icon: SparklesIcon,
    title: 'AI-powered insights',
    body: 'Attendance rate, peak check-in time, engagement score and certificate completion — computed in real time from on-chain data.',
  },
  {
    icon: GlobeIcon,
    title: 'Multi-network ready',
    body: 'Deploy to a local devnet, Midnight preview or preprod. The same dApp works everywhere with a one-command switch.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Create an event',
    body: 'An organizer publishes an event with a name, date and attendance threshold. The event and its threshold are committed on-chain.',
  },
  {
    num: '02',
    title: 'Attendees check in',
    body: 'Attendees scan a QR and check in with a fresh pseudonymous identity. The zero-knowledge proof reveals nothing about who they are.',
  },
  {
    num: '03',
    title: 'Certificates & insights',
    body: 'Once the threshold is met, attendees claim verifiable certificates. Organizers watch live attendance and AI insights update in real time.',
  },
];

const PRIVATE_ITEMS = [
  'Real identity of attendees',
  'Which attendee checked in when',
  'Attendee identity secrets',
  'Attendance patterns of an individual',
];

const PUBLIC_ITEMS = [
  'Events and their thresholds',
  'Aggregate attendance counts',
  'Certificate commitments',
  'Pseudonymous hashes only',
];

export function LandingPage() {
  const { events, wallet } = useApp();

  const totalAttendance = events?.reduce((acc, e) => acc + Number(e.attendance ?? 0), 0) ?? 0;
  const totalCerts = events?.reduce((acc, e) => acc + (e.certificateCount ?? 0), 0) ?? 0;
  const avgEngagement = events?.length
    ? Math.round(events.reduce((acc, e) => acc + (e.insights?.engagementScore ?? 0), 0) / events.length)
    : 0;
  const liveEvent = events?.find((e) => Number(e.attendance ?? 0) < Number(e.threshold ?? 1)) ?? events?.[0];

  return (
    <div>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">
            <ZapIcon size={15} />
            Built on the Midnight Network · Zero-knowledge blockchain
          </div>
          <h1>
            Attendance that's <span className="grad-text">private</span> — and
            certificates that are <span className="grad-text">provable</span>.
          </h1>
          <p className="hero-sub">
            ProofPresence turns event attendance and certificates into zero-knowledge proofs.
            No sign-ups, no personal data — just on-chain, verifiable truth.
          </p>
          <div className="hero-cta">
            <Link to="/organizer" className="btn btn-primary btn-lg">
              <UsersIcon size={18} /> Organize an event
            </Link>
            <Link to="/attend" className="btn btn-cyan btn-lg">
              <ScanIcon size={18} /> I'm an attendee
            </Link>
            <Link to="/verify" className="btn btn-ghost btn-lg">
              <ShieldIcon size={18} /> Verify a certificate
            </Link>
          </div>

          <div className="hero-stats" style={{ marginTop: 56 }}>
            <div className="hero-stat">
              <div className="num">
                <CountUp value={events?.length ?? 0} />
              </div>
              <div className="lbl">Events on-chain</div>
            </div>
            <div className="hero-stat">
              <div className="num">
                <CountUp value={totalAttendance} />
              </div>
              <div className="lbl">Check-ins</div>
            </div>
            <div className="hero-stat">
              <div className="num">
                <CountUp value={totalCerts} />
              </div>
              <div className="lbl">Certificates</div>
            </div>
            <div className="hero-stat">
              <div className="num">
                <CountUp value={avgEngagement} suffix="%" />
              </div>
              <div className="lbl">Avg. engagement</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section className="container" style={{ marginTop: 20 }}>
        <Reveal>
          <div className="center" style={{ marginBottom: 40 }}>
            <h2 className="section-title">
              How it <span className="grad-text">works</span>
            </h2>
            <p className="section-sub" style={{ margin: '12px auto 0' }}>
              A three-step flow that keeps attendee data private while everything important lives on-chain.
            </p>
          </div>
        </Reveal>
        <div className="steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 120}>
              <div className="card hoverable step">
                <div className="step-num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="container" style={{ marginTop: 110 }}>
        <Reveal>
          <div className="center" style={{ marginBottom: 40 }}>
            <h2 className="section-title">
              Everything you need, <span className="grad-text">nothing you don't</span>
            </h2>
            <p className="section-sub" style={{ margin: '12px auto 0' }}>
              Privacy-first tooling designed for real events — from meetups to hackathons to conferences.
            </p>
          </div>
        </Reveal>
        <div className="grid grid-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.title} delay={(i % 3) * 100}>
                <div className="card hoverable feature-card" style={{ height: '100%' }}>
                  <div className="feature-icon">
                    <Icon />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ─── Privacy ──────────────────────────────────────────────────────── */}
      <section className="container" style={{ marginTop: 110 }}>
        <Reveal>
          <div className="center" style={{ marginBottom: 40 }}>
            <h2 className="section-title">
              Radical <span className="grad-text">privacy</span> by construction
            </h2>
            <p className="section-sub" style={{ margin: '12px auto 0' }}>
              With ProofPresence, the question isn't "is my data safe?" — it's "what data even exists?"
            </p>
          </div>
        </Reveal>
        <div className="privacy-grid">
          <Reveal delay={0}>
            <div className="card privacy-card" style={{ borderColor: 'rgba(248,113,113,0.25)' }}>
              <h3>
                <LockIcon size={18} /> Never stored — private
              </h3>
              <ul>
                {PRIVATE_ITEMS.map((item) => (
                  <li key={item}>
                    <XMark />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="card privacy-card" style={{ borderColor: 'rgba(52,211,153,0.25)' }}>
              <h3>
                <GlobeIcon size={18} /> On-chain — public &amp; verifiable
              </h3>
              <ul>
                {PUBLIC_ITEMS.map((item) => (
                  <li key={item}>
                    <CheckMark />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Live demo ────────────────────────────────────────────────────── */}
      <section className="container" style={{ marginTop: 110 }}>
        <Reveal>
          <div className="card" style={{ padding: 36 }}>
            <div className="row between wrap" style={{ marginBottom: 22 }}>
              <div>
                <div className="row" style={{ gap: 10 }}>
                  <span className="live-dot" />
                  <h2 className="card-title" style={{ fontSize: 20 }}>
                    Live demo — {liveEvent?.name ?? 'no events yet'}
                  </h2>
                </div>
                <p className="card-sub">Real data, straight from the Midnight ledger.</p>
              </div>
              <Link to={wallet ? '/organizer' : '/wallet'} className="btn btn-primary">
                Open the app <ArrowRightIcon size={16} />
              </Link>
            </div>

            {liveEvent ? (
              <div className="grid grid-4">
                <Stat icon={UsersIcon} label="Attendance" value={liveEvent.attendance} glow="rgba(34,211,238,0.35)" />
                <Stat icon={CalendarIcon} label="Threshold" value={liveEvent.threshold} glow="rgba(251,191,36,0.35)" />
                <Stat icon={CertIcon} label="Certificates" value={String(liveEvent.certificateCount)} glow="rgba(52,211,153,0.35)" />
                <Stat icon={ChartIcon} label="Engagement" value={`${liveEvent.insights?.engagementScore ?? 0}%`} glow="rgba(109,93,246,0.35)" />
              </div>
            ) : (
              <p className="muted">Create your first event from the organizer dashboard to see live stats here.</p>
            )}
          </div>
        </Reveal>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────────── */}
      <section className="container" style={{ marginTop: 110 }}>
        <Reveal>
          <div
            className="card card-glow center"
            style={{
              padding: '56px 30px',
              background: 'radial-gradient(ellipse at 50% 0%, rgba(109,93,246,0.18), transparent 65%)',
            }}
          >
            <h2 className="section-title">
              Ready to run a <span className="grad-text">private</span> event?
            </h2>
            <p className="section-sub" style={{ margin: '14px auto 0' }}>
              Spin up a local Midnight devnet, deploy the contract, and have live attendance + verifiable certificates in minutes.
            </p>
            <div className="hero-cta" style={{ marginTop: 28 }}>
              <Link to="/wallet" className="btn btn-primary btn-lg">
                <WalletIcon size={18} /> Connect wallet
              </Link>
              <Link to="/verify" className="btn btn-ghost btn-lg">
                <ShieldIcon size={18} /> Verify a certificate
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <div style={{ height: 40 }} />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  glow,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string | number;
  glow: string;
}) {
  return (
    <div className="card stat" style={{ ['--glow' as any]: glow }}>
      <Icon size={20} />
      <div className="value">
        <CountUp value={Number(String(value).replace('%', ''))} suffix={String(value).includes('%') ? '%' : ''} />
      </div>
      <div className="label" style={{ marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

function XMark() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 4 }}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 4 }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
