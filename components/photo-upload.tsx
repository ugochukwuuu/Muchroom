'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Images } from 'lucide-react';

export function PhotoUpload({ product, purpose, slots }: { product: string; purpose: 'listing' | 'issue'; slots?: number }) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const note = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function upload(files: FileList | null) {
    if (!files?.length || progress) return;
    const photos = Array.from(files);
    setError('');
    setMessage('');
    let saved = 0;
    try {
      if (slots !== undefined && photos.length > slots) throw new Error(`Choose up to ${slots} more ${slots === 1 ? 'photo' : 'photos'}.`);
      for (const [index, photo] of photos.entries()) {
        setProgress(`Uploading photo ${index + 1} of ${photos.length}…`);
        if (photo.size > 8 * 1024 * 1024) throw new Error('Choose photos under 8 MB each.');
        const form = new FormData();
        form.set('file', photo);
        form.set('purpose', purpose);
        if (note.current?.value) form.set('note', note.current.value);
        const response = await fetch(`/api/admin/product-photos/${product}`, { method: 'POST', body: form });
        if (!response.ok) {
          const data = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(data?.error ?? 'Could not upload the photo.');
        }
        saved += 1;
      }
      setMessage(saved === 1 ? 'Photo added.' : `${saved} photos added.`);
      if (note.current) note.current.value = '';
    } catch (cause) {
      setError((saved ? `${saved} added. ` : '') + (cause instanceof Error ? cause.message : 'The upload failed.'));
    } finally {
      setProgress('');
      if (picker.current) picker.current.value = '';
      if (camera.current) camera.current.value = '';
      if (saved) router.refresh();
    }
  }

  return <div className="form-stack">
    {purpose === 'issue' && <label>Issue note (optional)<input ref={note} maxLength={300} placeholder="For example, cracked hinge"/></label>}
    <input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp" multiple onChange={event => void upload(event.currentTarget.files)}/>
    <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={event => void upload(event.currentTarget.files)}/>
    <div className="prompt-row">
      <button className="button soft" type="button" disabled={Boolean(progress)} onClick={() => picker.current?.click()}><Images size={16}/> Choose photos</button>
      <button className="button soft" type="button" disabled={Boolean(progress)} onClick={() => camera.current?.click()}><Camera size={16}/> Take photo</button>
    </div>
    {(progress || message) && <p className="muted" role="status">{progress || message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}
