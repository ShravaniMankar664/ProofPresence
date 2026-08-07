import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrIcon } from './icons';

export function QRCodeImage({ text, size = 220, className = '' }: { text: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1020', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  if (!src) {
    return (
      <div style={{ width: size, height: size, display: 'grid', placeItems: 'center', background: '#fff', borderRadius: 16 }}>
        <div className="spinner" />
      </div>
    );
  }
  return (
    <div className={`qr-shell ${className}`}>
      <img src={src} alt="QR code" width={size} height={size} />
    </div>
  );
}

/** Small reusable "QR code" button that reveals a modal with a QR. */
export function QRButton({ text, title, label = 'Show QR' }: { text: string; title: string; label?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <QrIcon size={16} /> {label}
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{ textAlign: 'center' }}
          >
            <h3 className="card-title" style={{ justifyContent: 'center' }}>
              {title}
            </h3>
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 18 }}>
              <QRCodeImage text={text} size={240} />
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>
              Scan with the ProofPresence attendee scanner or any camera.
            </p>
            <button className="btn btn-ghost btn-sm mt-2" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
