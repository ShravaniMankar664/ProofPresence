import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';
import { Scanner } from '../components/Scanner';
import { CopyButton } from '../components/Toasts';
import { CheckIcon, GlobeIcon, QrIcon, ScanIcon, ShieldIcon, XIcon } from '../components/icons';

export function VerifyPage() {
  const { pushToast } = useApp();
  const [params] = useSearchParams();
  const [cert, setCert] = useState('');
  const [result, setResult] = useState<{ valid: boolean; network: string; contractAddress: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const checkedOnce = useRef<string | null>(null);

  // Prefill from ?cert=<hex> (deep link from a certificate QR)
  useEffect(() => {
    const c = params.get('cert');
    if (c && /^[0-9a-f]{64}$/i.test(c)) {
      setCert(c.toLowerCase());
      if (checkedOnce.current !== c.toLowerCase()) {
        checkedOnce.current = c.toLowerCase();
        void verify(c.toLowerCase());
      }
    }
  }, [params]);

  async function verify(certId: string) {
    setChecking(true);
    setResult(null);
    try {
      const res = await api.verify(certId);
      setResult({ valid: res.valid, network: res.network, contractAddress: res.contractAddress });
    } catch (err: any) {
      setResult({ valid: false, network: '—', contractAddress: '—' });
    } finally {
      setChecking(false);
    }
  }

  function onScan(data: string) {
    const trimmed = data.trim();
    let certId: string | null = null;
    const match = trimmed.match(/[0-9a-f]{64}/i);
    if (match) certId = match[0].toLowerCase();
    if (!certId) {
      pushToast('QR does not look like a ProofPresence certificate', 'error');
      return;
    }
    setCert(certId);
    setScannerOpen(false);
    void verify(certId);
  }

  return (
    <div className="container page" style={{ maxWidth: 760 }}>
      <div className="center" style={{ marginBottom: 34 }}>
        <div className="hero-badge">
          <ShieldIcon size={15} /> On-chain verification
        </div>
        <h1 className="section-title">
          Verify a <span className="grad-text">certificate</span>
        </h1>
        <p className="section-sub" style={{ margin: '12px auto 0' }}>
          Any certificate issued by ProofPresence is a commitment stored on the Midnight blockchain. Enter a certificate
          ID — or scan its QR — and verify it instantly, without the organizer.
        </p>
      </div>

      <div className="card" style={{ padding: 26 }}>
        <div className="row" style={{ gap: 10 }}>
          <input
            className="input mono"
            style={{ flex: 1 }}
            placeholder="Certificate ID (64 hex chars)…"
            value={cert}
            onChange={(e) => setCert(e.target.value.toLowerCase().replace(/[^0-9a-f]/g, ''))}
            spellCheck={false}
          />
          <button className="btn btn-ghost" onClick={() => setScannerOpen((v) => !v)}>
            <ScanIcon size={16} /> Scan
          </button>
          <button className="btn btn-primary" disabled={cert.length !== 64 || checking} onClick={() => void verify(cert)}>
            {checking ? <span className="spinner" /> : <ShieldIcon size={16} />} Verify
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          Hint: certificates are 64-character hex strings. You can also scan a certificate QR code.
        </p>

        {scannerOpen && (
          <div className="mt-3">
            <Scanner onScan={onScan} onClose={() => setScannerOpen(false)} />
          </div>
        )}
      </div>

      <div className="mt-3" style={{ minHeight: 200 }}>
        {checking && (
          <div className="loading-block">
            <div className="spinner spinner-lg" />
            Querying the Midnight indexer…
          </div>
        )}

        {result && !checking && (
          <div className={`verify-result ${result.valid ? 'valid' : 'invalid'}`} style={{ animation: 'page-in 0.5s ease both' }}>
            <div className="verify-icon">{result.valid ? <CheckIcon /> : <XIcon />}</div>
            <h2 className="verify-title" style={{ color: result.valid ? '#6ee7b7' : '#fca5a5' }}>
              {result.valid ? 'Certificate verified' : 'Certificate not found'}
            </h2>
            <p className="muted" style={{ maxWidth: 480, margin: '10px auto 0' }}>
              {result.valid
                ? 'This certificate exists as a commitment on the Midnight blockchain. It is authentic and was never tampered with.'
                : 'No certificate matching this ID was found on the Midnight blockchain. It may be invalid, or the ID may be incorrect.'}
            </p>

            <div className="card" style={{ textAlign: 'left', marginTop: 22, background: 'rgba(7,10,18,0.5)' }}>
              <div className="stack" style={{ gap: 10 }}>
                <DetailRow label="Certificate ID">
                  <span className="hash" style={{ wordBreak: 'break-all' }}>{cert}</span>
                  <CopyButton text={cert} />
                </DetailRow>
                <DetailRow label="Network">
                  <span className="badge badge-cyan">{result.network}</span>
                </DetailRow>
                <DetailRow label="Contract">
                  <span className="hash" style={{ wordBreak: 'break-all' }}>{result.contractAddress}</span>
                  <CopyButton text={result.contractAddress} />
                </DetailRow>
                <DetailRow label="Verification type">
                  <span className="badge badge-green">
                    <GlobeIcon size={12} /> on-chain membership
                  </span>
                </DetailRow>
              </div>
            </div>

            <div className="center mt-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const text = result.valid
                    ? `${window.location.origin}${window.location.pathname}#/verify?cert=${cert}`
                    : 'Try scanning or entering another certificate ID.';
                  if (result.valid) navigator.clipboard.writeText(text).catch(() => undefined);
                  setResult(null);
                  setCert('');
                }}
              >
                <QrIcon size={14} /> Verify another
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card mt-4" style={{ padding: 22 }}>
        <h3 className="card-title">
          <QrIcon size={17} /> How it works
        </h3>
        <div className="stack mt-2" style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
          <p style={{ margin: 0 }}>
            When an attendee claims a certificate, the contract inserts <span className="mono">certificateId =
            hash("ppai:cert:", eventId, identity)</span> into the on-chain <span className="mono">certificates</span> set —
            publicly and immutably.
          </p>
          <p style={{ margin: 0 }}>
            Verification queries the indexer for membership of that ID. Because the commitment is on-chain, anyone can
            verify it at any time — no organizer, no trusted server, no personal data involved.
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 4 }}>
        {label}
      </div>
      <div className="row wrap" style={{ gap: 10 }}>
        {children}
      </div>
    </div>
  );
}
