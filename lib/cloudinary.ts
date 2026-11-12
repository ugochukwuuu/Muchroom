import { createHash, randomUUID } from 'node:crypto';

export const maxPhotoBytes = 8 * 1024 * 1024;
export const photoFormats = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
type Format = keyof typeof photoFormats;
type Delivery = 'upload' | 'authenticated';

function config() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const key = process.env.CLOUDINARY_API_KEY?.trim();
  const secret = process.env.CLOUDINARY_API_SECRET?.trim();
  return cloud && /^[a-zA-Z0-9_-]+$/.test(cloud) && key && secret ? { cloud, key, secret } : null;
}

export function photoUploadsEnabled() {
  return Boolean(config());
}

export async function identifyPhoto(file: File): Promise<Format | null> {
  const header = Buffer.from(await file.slice(0, 12).arrayBuffer());
  if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function signed(params: Record<string, string>, credentials: NonNullable<ReturnType<typeof config>>) {
  const payload = Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join('&');
  const signature = createHash('sha256').update(payload + credentials.secret).digest('hex');
  return { ...params, api_key: credentials.key, signature };
}

function endpoint(cloud: string, action: string) {
  return `https://api.cloudinary.com/v1_1/${cloud}/image/${action}`;
}
const timestamp = () => String(Math.floor(Date.now() / 1000));

export async function uploadPhoto(file: File, format: Format, type: Delivery) {
  const credentials = config();
  if (!credentials) throw new Error('Cloudinary credentials are missing.');
  const publicId = `muchroom/${type === 'authenticated' ? 'issues' : 'products'}/${randomUUID()}`;
  const payload = new FormData();
  for (const [name, value] of Object.entries(signed({
    timestamp: timestamp(), type, public_id: publicId, overwrite: 'false', allowed_formats: 'jpg,png,webp',
  }, credentials))) payload.set(name, value);
  payload.set('file', file, `photo.${format}`);
  const response = await fetch(endpoint(credentials.cloud, 'upload'), {
    method: 'POST', body: payload, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Cloudinary upload failed (${response.status}).`);
  const asset = await response.json() as { public_id: string; type: string; secure_url: string; format: Format };
  if (asset.public_id !== publicId || asset.type !== type || !Object.hasOwn(photoFormats, asset.format)
    || !asset.secure_url?.startsWith('https://')) throw new Error('Unexpected Cloudinary upload response.');
  return { publicId, url: type === 'upload' ? asset.secure_url : null, format: asset.format };
}

export async function discardPhoto(publicId: string, type: Delivery) {
  const credentials = config();
  if (!credentials) return;
  const response = await fetch(endpoint(credentials.cloud, 'destroy'), {
    method: 'POST', body: new URLSearchParams(signed({
      timestamp: timestamp(), type, public_id: publicId, invalidate: 'true',
    }, credentials)), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Cloudinary cleanup failed (${response.status}).`);
}

export async function downloadIssuePhoto(publicId: string, format: Format) {
  const credentials = config();
  if (!credentials) throw new Error('Cloudinary credentials are missing.');
  const params = new URLSearchParams(signed({
    timestamp: timestamp(), type: 'authenticated', public_id: publicId, format,
  }, credentials));
  return fetch(`${endpoint(credentials.cloud, 'download')}?${params}`, {
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
}
