'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';

export function PhotoCamera({ disabled, onPhoto }: { disabled: boolean; onPhoto: (file: File) => void }) {
  const fallback = useRef<HTMLInputElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef(0);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    request.current += 1;
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);

  const close = useCallback(() => {
    request.current += 1;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setReady(false);
    setOpen(false);
  }, []);

  useEffect(() => {
    const details = controls.current?.closest('details');
    if (!details) return;
    const stopIfClosed = () => { if (!details.open) close(); };
    details.addEventListener('toggle', stopIfClosed);
    return () => details.removeEventListener('toggle', stopIfClosed);
  }, [close]);

  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      fallback.current?.click();
      return;
    }
    const attempt = ++request.current;
    setOpen(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (attempt !== request.current) {
        media.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = media;
      if (video.current) video.current.srcObject = media;
    } catch (cause) {
      if (attempt !== request.current) return;
      close();
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError'
        ? 'Allow camera access in your browser, or choose a photo from your device.'
        : 'Could not open a camera. Choose a photo from your device.');
    }
  }

  function capture() {
    const frame = video.current;
    if (!frame?.videoWidth || !frame.videoHeight) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(frame.videoWidth, frame.videoHeight));
    canvas.width = Math.round(frame.videoWidth * scale);
    canvas.height = Math.round(frame.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Could not capture the photo. Try again or choose a file.');
      return;
    }
    context.drawImage(frame, 0, 0, canvas.width, canvas.height);
    const attempt = request.current;
    canvas.toBlob(blob => {
      if (attempt !== request.current) return;
      if (!blob) {
        setError('Could not capture the photo. Try again or choose a file.');
        return;
      }
      onPhoto(new File([blob], 'product-camera.jpg', { type: 'image/jpeg' }));
      close();
    }, 'image/jpeg', 0.85);
  }

  return <div ref={controls} className="form-stack">
    <input ref={fallback} type="file" hidden accept="image/jpeg,image/png,image/webp" capture="environment"
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        if (file) onPhoto(file);
        event.currentTarget.value = '';
      }}/>
    {open ? <>
      <video ref={element => {
        video.current = element;
        if (element && stream.current && element.srcObject !== stream.current) element.srcObject = stream.current;
      }} className="camera-preview" aria-label="Camera preview" muted playsInline autoPlay onCanPlay={() => setReady(true)}/>
      {!ready && <small role="status">Waiting for camera access…</small>}
      <div className="prompt-row">
        <button type="button" className="button primary" disabled={!ready || disabled} onClick={capture}>Capture photo</button>
        <button type="button" className="text-button" onClick={close}>Close camera</button>
      </div>
    </> : <button type="button" className="button soft" onClick={() => void start()} disabled={disabled}><Camera size={16}/> Take photo</button>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}
