import { connectWallet } from "../wallet";
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { CopyButton } from '../components/Toasts';
import {
  CheckIcon,
  GlobeIcon,
  LockIcon,
  ScanIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
} from '../components/icons';

type Step = { id: string; label: string; state: 'waiting' | 'active' | 'done' };

export function WalletPage() {
  const { wallet, events, pushToast } = useApp();
  const [browserWallet, setBrowserWallet] = useState<any | null>(null);
  const [browserConnecting, setBrowserConnecting] = useState(false);

  const handleConnectWallet = async () => {
  setBrowserConnecting(true);

  try {
    const connectedWallet = await connectWallet();

    if (connectedWallet) {
      setBrowserWallet(connectedWallet);
      pushToast("1AM Wallet connected", "success");
    }
  } finally {
    setBrowserConnecting(false);
  }
};
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'connecting' | 'connected'>('connecting');
  const settled = useRef(false);
  const [steps, setSteps] = useState<Step[]>([
    { id: 'keys', label: 'Deriving zero-knowledge keys', state: 'active' },
    { id: 'sync', label: 'Syncing with the Midnight network', state: 'waiting' },
    { id: 'contract', label: 'Connecting to the ProofPresence contract', state: 'waiting' },
  ]);

  useEffect(() => {
    // Run the animation once, the first time the wallet appears. The store
    // re-polls every few seconds, so guard against re-playing it.
    if (!wallet || settled.current) return;
    settled.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const advance = (i: number, state: 'active' | 'done') =>
      setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, state } : s)));

    timers.push(setTimeout(() => advance(0, 'done'), 900));
    timers.push(setTimeout(() => advance(1, 'active'), 1100));
    timers.push(setTimeout(() => advance(1, 'done'), 1900));
    timers.push(setTimeout(() => advance(2, 'active'), 2100));
    timers.push(
      setTimeout(() => {
        advance(2, 'done');
        setPhase('connected');
        pushToast('Wallet connected', 'success');
      }, 2900),
    );
    return () => timers.forEach(clearTimeout);
  }, [wallet, pushToast]);

  const eventCount = events?.length ?? 0;
  const tNight = Number(wallet?.balance?.tNight ?? 0) / 1e12;
  const dust = wallet?.balance?.dust ?? '0';

  return (
    <div className="container page" style={{ maxWidth: 680 }}>
      <div className="center" style={{ marginBottom: 34 }}>
        <div className="hero-badge">
          <ShieldIcon size={15} /> Midnight wallet
        </div>
        <h1 className="section-title">
          Connect your <span className="grad-text">wallet</span>
        </h1>
        <p className="section-sub" style={{ margin: '12px auto 0' }}>
          ProofPresence runs on the Midnight Network. Connect to begin organizing events or attending with a
          pseudonymous identity.
        </p>
      </div>

      <div className="card card-glow" style={{ padding: 32 }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 26 }}>
          <div
            className={`feature-icon ${phase === 'connected' ? 'card-glow' : ''}`}
            style={{ width: 84, height: 84, borderRadius: 26, background: 'var(--grad)', border: 'none' }}
          >
            <WalletIcon size={40} color="#fff" />
          </div>
        </div>

        {phase === 'connecting' && (
          <div className="stack">
            {steps.map((s) => (
              <div key={s.id} className="row" style={{ gap: 14, opacity: s.state === 'waiting' ? 0.45 : 1 }}>
                {s.state === 'done' ? (
                  <CheckIcon size={18} color="#34d399" />
                ) : s.state === 'active' ? (
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2.5 }} />
                ) : (
                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)' }} />
                )}
                <span style={{ fontSize: 14, fontWeight: s.state === 'active' ? 600 : 500 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {phase === 'connected' && wallet && (
          <div style={{ animation: 'page-in 0.5s ease both' }}>
            <div className="row between wrap" style={{ gap: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.05 }}>Connected address</div>
                <div className="mono" style={{ fontSize: 14, wordBreak: 'break-all', marginTop: 6 }}>
                  {wallet.walletAddress}
                </div>
              </div>
              <CopyButton text={wallet.walletAddress} />
            </div>

            <div className="grid grid-2 mt-3">
              <div className="card stat" style={{ ['--glow' as any]: 'rgba(34,211,238,0.4)' }}>
                <GlobeIcon size={20} />
                <div className="value">{tNight.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <div className="label">tNIGHT balance</div>
              </div>
              <div className="card stat" style={{ ['--glow' as any]: 'rgba(251,191,36,0.4)' }}>
                <SparklesIcon size={20} />
                <div className="value">{(Number(dust) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="label">DUST for proofs</div>
              </div>
            </div>

            <div className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>
              Network: <b>{wallet.network}</b> · {eventCount} event{eventCount === 1 ? '' : 's'} on-chain
            </div>

            <hr className="divider" />

            <div className="muted" style={{ fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <LockIcon size={14} /> Choose your role
            </div>

          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
  <div className="row between wrap" style={{ gap: 12 }}>
    <div>
      <div
        className="muted"
        style={{
          fontSize: 12.5,
          textTransform: 'uppercase',
          letterSpacing: 0.05,
        }}
      >
        1AM Wallet
      </div>

      <div style={{ marginTop: 6, fontSize: 14 }}>
        {browserWallet
          ? 'Browser wallet connected'
          : 'Connect your Midnight wallet'}
      </div>
    </div>

    {!browserWallet && (
      <button
        className="btn btn-primary"
        onClick={handleConnectWallet}
        disabled={browserConnecting}
      >
        {browserConnecting ? 'Connecting…' : 'Connect 1AM Wallet'}
      </button>
    )}
  </div>

  {browserWallet && (
    <div
      className="mono"
      style={{
        marginTop: 14,
        fontSize: 13,
        wordBreak: 'break-all',
      }}
    >
      Wallet connected successfully
    </div>
  )}
</div>
  
          <div className="grid grid-2">
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/organizer')}>
                <UsersIcon size={18} /> I'm an organizer
              </button>
              <button className="btn btn-cyan btn-lg" onClick={() => navigate('/attend')}>
                <ScanIcon size={18} /> I'm an attendee
              </button>
            </div>

            <div className="center mt-3">
              <Link to="/" className="muted" style={{ fontSize: 13 }}>
                or go back to the homepage
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
