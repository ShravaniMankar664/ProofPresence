import { useState } from 'react';
import { useApp } from '../store';
import { CheckIcon, CopyIcon, XIcon } from './icons';

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span style={{ marginTop: 1 }}>
            {t.type === 'success' ? <CheckIcon size={16} /> : t.type === 'error' ? <XIcon size={16} /> : <InfoDot />}
          </span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: 0 }}>
            <XIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function InfoDot() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { pushToast } = useApp();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      pushToast(label ?? 'Copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      pushToast('Copy failed', 'error');
    }
  };

  return (
    <button className="btn btn-ghost btn-sm" onClick={copy} title="Copy">
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {label ?? ''}
    </button>
  );
}
