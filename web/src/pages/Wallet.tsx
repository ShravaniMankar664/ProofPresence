import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { CopyButton } from '../components/Toasts';
import {
  connectWallet,
  disconnectWallet,
  getConnectedWallet,
} from '../wallet';

import {
  GlobeIcon,
  LockIcon,
  ScanIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
} from '../components/icons';

export function WalletPage() {
  const { wallet, events, pushToast } = useApp();
  const navigate = useNavigate();

  const [browserWallet, setBrowserWallet] = useState<any | null>(
    getConnectedWallet()
  );
  const [browserConnecting, setBrowserConnecting] = useState(false);

  useEffect(() => {
    setBrowserWallet(getConnectedWallet());
  }, []);

  const handleConnectWallet = async () => {
    if (browserConnecting) return;

    setBrowserConnecting(true);

    try {
      const connectedWallet = await connectWallet();

      if (connectedWallet) {
        setBrowserWallet(connectedWallet);
        pushToast('1AM Wallet connected', 'success');
      }
    } catch (error) {
      console.error('1AM Wallet connection failed:', error);
      pushToast('1AM Wallet connection failed', 'error');
    } finally {
      setBrowserConnecting(false);
    }
  };

  const handleDisconnectWallet = async () => {
    await disconnectWallet();
    setBrowserWallet(null);
    pushToast('1AM Wallet disconnected', 'info');
  };

  const eventCount = events?.length ?? 0;

  const tNight =
    Number(wallet?.balance?.tNight ?? 0) / 1e12;

  const dust = wallet?.balance?.dust ?? '0';

  return (
    <div
      className="container page"
      style={{ maxWidth: 680 }}
    >
      <div
        className="center"
        style={{ marginBottom: 34 }}
      >
        <div
          className="feature-icon"
          style={{
            width: 84,
            height: 84,
            borderRadius: 26,
            background: 'var(--grad)',
            border: 'none',
            margin: '0 auto 20px',
          }}
        >
          <WalletIcon size={40} color="#fff" />
        </div>

        <div className="eyebrow">
          Midnight wallet
        </div>

        <h1>
          Connect your <span className="accent">wallet</span>
        </h1>

        <p
          className="section-sub"
          style={{ margin: '12px auto 0' }}
        >
          ProofPresence runs on the Midnight Network.
          Connect to begin organizing events or attending
          with a pseudonymous identity.
        </p>
      </div>

      <div
        className="card card-glow"
        style={{ padding: 32 }}
      >
        {/* 1AM WALLET CONNECTION */}
        <div
          className="card"
          style={{
            padding: 22,
            marginBottom: 24,
          }}
        >
          <div
            className="row"
            style={{
              gap: 12,
              marginBottom: 10,
            }}
          >
            <WalletIcon size={20} />

            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {browserWallet
                  ? '1AM Wallet connected'
                  : 'Connect your Midnight wallet'}
              </div>

              <div
                className="muted"
                style={{
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {browserWallet
                  ? 'Your browser wallet is connected to ProofPresence.'
                  : 'Connect 1AM Wallet to authorize this dApp.'}
              </div>
            </div>
          </div>

          {!browserWallet ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleConnectWallet}
              disabled={browserConnecting}
              style={{
                width: '100%',
                marginTop: 14,
              }}
            >
              <WalletIcon size={18} />

              {browserConnecting
                ? 'Connecting to 1AM…'
                : 'Connect 1AM Wallet'}
            </button>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div
                className="mono"
                style={{
                  fontSize: 13,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(52, 211, 153, 0.08)',
                  marginBottom: 12,
                }}
              >
                ✓ Wallet connected successfully
              </div>

              <button
                className="btn btn-lg"
                onClick={handleDisconnectWallet}
                style={{
                  width: '100%',
                }}
              >
                Disconnect Wallet
              </button>
            </div>
          )}
        </div>

        {/* SERVER / MIDNIGHT STATUS */}
        {wallet ? (
          <>
            <div
              className="row between wrap"
              style={{ gap: 12 }}
            >
              <div>
                <div
                  className="muted"
                  style={{
                    fontSize: 12.5,
                    textTransform: 'uppercase',
                    letterSpacing: 0.05,
                  }}
                >
                  Connected address
                </div>

                <div
                  className="mono"
                  style={{
                    fontSize: 14,
                    wordBreak: 'break-all',
                    marginTop: 6,
                  }}
                >
                  {wallet.walletAddress}
                </div>
              </div>

              <CopyButton
                text={wallet.walletAddress}
              />
            </div>

            <div className="grid grid-2 mt-3">
              <div
                className="card stat"
                style={{
                  ['--glow' as any]:
                    'rgba(34,211,238,0.4)',
                }}
              >
                <GlobeIcon size={20} />

                <div className="value">
                  {tNight.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </div>

                <div className="label">
                  tNIGHT balance
                </div>
              </div>

              <div
                className="card stat"
                style={{
                  ['--glow' as any]:
                    'rgba(251,191,36,0.4)',
                }}
              >
                <SparklesIcon size={20} />

                <div className="value">
                  {(
                    Number(dust) / 1e18
                  ).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>

                <div className="label">
                  DUST for proofs
                </div>
              </div>
            </div>

            <div
              className="muted"
              style={{
                fontSize: 12.5,
                marginTop: 16,
              }}
            >
              Network: <b>{wallet.network}</b> ·{' '}
              {eventCount} event
              {eventCount === 1 ? '' : 's'} on-chain
            </div>
          </>
        ) : (
          <div
            className="muted center"
            style={{
              padding: '18px 0',
              fontSize: 13,
            }}
          >
            Waiting for the ProofPresence server wallet…
          </div>
        )}

        <hr className="divider" />

        {/* ROLE SELECTION */}
        <div
          className="muted"
          style={{
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <LockIcon size={14} />
          Choose your role
        </div>

        <div className="grid grid-2">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/organizer')}
          >
            <UsersIcon size={18} />
            I'm an organizer
          </button>

          <button
            className="btn btn-cyan btn-lg"
            onClick={() => navigate('/attend')}
          >
            <ScanIcon size={18} />
            I'm an attendee
          </button>
        </div>

        <div className="center mt-3">
          <Link
            to="/"
            className="muted"
            style={{ fontSize: 13 }}
          >
            or go back to the homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
