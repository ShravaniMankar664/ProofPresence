import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraIcon, XIcon } from './icons';

/**
 * Browser QR scanner built on getUserMedia + jsQR (pure JS decoder — no native
 * deps). Handles permission denial and missing cameras gracefully.
 */
export function Scanner({ onScan, onClose }: { onScan: (data: string) => void; onClose?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus('ready');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const loop = () => {
          rafRef.current = requestAnimationFrame(loop);
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
            if (code && code.data && Date.now() - lastScanRef.current > 2500) {
              lastScanRef.current = Date.now();
              onScanRef.current(code.data);
            }
          }
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (err: any) {
        if (!mounted) return;
        setStatus('error');
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera access or paste the event ID manually.'
            : err?.name === 'NotFoundError'
              ? 'No camera found on this device.'
              : `Camera error: ${err?.message ?? err}`,
        );
      }
    }

    start();
    return () => {
      mounted = false;
      stop();
    };
  }, [stop]);

  return (
    <div>
      <div className="scanner-viewport">
        <video ref={videoRef} className="scanner-video" playsInline muted />
        {status === 'loading' && (
          <div className="loading-block" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}>
            <div className="spinner spinner-lg" />
            <span>Starting camera…</span>
          </div>
        )}
        {status === 'ready' && (
          <>
            <div className="scanner-frame" />
            <div className="scanner-line" />
          </>
        )}
        {status === 'error' && (
          <div className="loading-block" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', padding: 20 }}>
            <CameraIcon size={34} />
            <span style={{ maxWidth: 320 }}>{error}</span>
          </div>
        )}
        {onClose && (
          <button
            onClick={() => {
              stop();
              onClose();
            }}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
            aria-label="Close scanner"
          >
            <XIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
