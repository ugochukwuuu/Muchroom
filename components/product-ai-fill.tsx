'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cleanSuggestions, maxScanBytes } from '../lib/product-scan';
import { PhotoCamera } from './photo-camera';
import { maxProductPhotos } from '../lib/types';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Preview = { file: File; url: string };

export function ProductAiFill({ enabled, canAttachPhoto, savedPhotos }: { enabled: boolean; canAttachPhoto: boolean; savedPhotos: number }) {
  const input = useRef<HTMLInputElement>(null);
  const previous = useRef(new Map<Field, { before: string; suggestion: string }>());
  const currentPhotos = useRef<Preview[]>([]);
  const [photos, setPhotos] = useState<Preview[]>([]);
  const selected = photos.length > 0;
  const remaining = Math.max(0, maxProductPhotos - savedPhotos);
  const canSaveSelection = canAttachPhoto && photos.length <= remaining;
  const [attach, setAttach] = useState(true);
  const [filled, setFilled] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const release = () => {
      currentPhotos.current.forEach(photo => URL.revokeObjectURL(photo.url));
      currentPhotos.current = [];
    };
    const resetPreview = () => {
      release();
      setPhotos([]);
    };
    form.addEventListener('reset', resetPreview);
    return () => {
      form.removeEventListener('reset', resetPreview);
      release();
    };
  }, []);

  function undoSuggestions() {
    for (const [field, { before, suggestion }] of previous.current) {
      if (field.value === suggestion) field.value = before;
    }
    previous.current.clear();
    setFilled(false);
  }

  function clearFill() {
    undoSuggestions();
    updatePhotos([]);
    setAttach(true);
    setMessage('');
    setError('');
  }

  function updatePhotos(next: Preview[]) {
    currentPhotos.current.filter(photo => !next.includes(photo)).forEach(photo => URL.revokeObjectURL(photo.url));
    currentPhotos.current = next;
    const selection = new DataTransfer();
    next.forEach(photo => selection.items.add(photo.file));
    if (input.current) input.current.files = selection.files;
    setPhotos(next);
  }

  function addPhotos(files: File[]) {
    const valid = files.filter(file => file.size > 0 && file.size <= maxScanBytes);
    const space = maxProductPhotos - currentPhotos.current.length;
    const additions = valid.slice(0, space).map(file => ({ file, url: URL.createObjectURL(file) }));
    updatePhotos([...currentPhotos.current, ...additions]);
    setMessage('');
    setError(valid.length > space ? 'You can select up to 3 photos.' :
      valid.length < files.length ? 'Choose photos up to 4 MB each.' : '');
  }

  async function scan() {
    const file = photos[0]?.file;
    const form = input.current?.form;
    if (!enabled || !file || !form || pending) return;
    setError('');
    setMessage('');
    if (file.size > maxScanBytes) {
      setError('Choose a photo up to 4 MB.');
      return;
    }
    setPending(true);
    const body = new FormData();
    body.set('photo', file);
    try {
      const response = await fetch('/api/admin/product-scan', { method: 'POST', body });
      const data = await response.json() as { suggestions?: unknown; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Could not scan the photo.');
      const suggestions = cleanSuggestions(data.suggestions);
      if (!Object.keys(suggestions).length) {
        setMessage('Gemini couldn’t identify this product. Try a clearer photo of the label.');
        return;
      }
      undoSuggestions();
      for (const [name, suggestion] of Object.entries(suggestions)) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
          previous.current.set(field, { before: field.value, suggestion });
          field.value = suggestion;
        }
      }
      setFilled(previous.current.size > 0);
      setMessage('Review the suggested details before saving.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The scan failed.');
    } finally {
      setPending(false);
    }
  }

  return <fieldset className="panel form-stack product-ai">
    <legend>Fill from a photo</legend>
    <label>Product photos (up to 3)
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple
        name={canSaveSelection && attach && selected ? 'listingPhoto' : undefined}
        disabled={pending}
        onChange={event => addPhotos(Array.from(event.currentTarget.files ?? []))}/>
    </label>
    <PhotoCamera disabled={pending || photos.length >= maxProductPhotos} onPhoto={file => addPhotos([file])}/>
    {selected && <ul className="listing-photo-previews" aria-label="Selected product photos">
      {photos.map((photo, index) => <li key={photo.url}>
        <div className="product-image"><img src={photo.url} alt={`Selected product photo ${index + 1}`}/></div>
        <button type="button" className="text-button" disabled={pending} aria-label={`Remove selected photo ${index + 1}`}
          onClick={() => { updatePhotos(photos.filter(item => item !== photo)); setError(''); }}>Remove</button>
      </li>)}
    </ul>}
    {canSaveSelection && selected && <label className="checkbox"><input type="checkbox" checked={attach} onChange={event => setAttach(event.target.checked)}/> Add selected photos to the listing when I save</label>}
    {!canAttachPhoto && selected && <small>Configure Cloudinary to save selected photos to the listing.</small>}
    {canAttachPhoto && selected && !canSaveSelection && <small>{remaining
      ? `Only ${remaining} more ${remaining === 1 ? 'photo fits' : 'photos fit'}. Remove extra selections to attach them.`
      : 'This listing is full. You can still use the selected photo for AI fill.'}</small>}
    <div className="prompt-row">
      <button type="button" className="button soft" onClick={() => void scan()} disabled={!enabled || !selected || pending}>
        <Sparkles size={16}/>{pending ? 'Scanning photo…' : 'Use AI to fill'}
      </button>
      {filled && <button type="button" className="text-button" onClick={clearFill} disabled={pending}>Clear AI fill</button>}
    </div>
    {enabled ? <small>AI fill sends the first selected photo to Google Gemini.</small> : <small>Set GEMINI_API_KEY to enable AI fill.</small>}
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </fieldset>;
}
