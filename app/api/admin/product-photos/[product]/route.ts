import { isStaff } from '../../../../../lib/auth';
import { discardPhoto, identifyPhoto, maxPhotoBytes, photoUploadsEnabled, uploadPhoto } from '../../../../../lib/cloudinary';
import { db, inventoryTransaction } from '../../../../../lib/db';
import { insertProductPhoto, listingPhotoCount, listingPhotoLimitMessage } from '../../../../../lib/product-photos';
import { maxProductPhotos, uuidPattern } from '../../../../../lib/types';

type Context = { params: Promise<{ product: string }> };
const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request, { params }: Context) {
  if (!(await isStaff())) return error('Sign in to upload photos.', 401);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return error('Invalid upload origin.', 403);
  const { product } = await params;
  if (!uuidPattern.test(product)) return error('Product not found.', 404);
  if (!photoUploadsEnabled()) return error('Configure Cloudinary to upload photos.', 503);
  if (Number(request.headers.get('content-length')) > maxPhotoBytes + 65536) return error('Choose a photo under 8 MB.', 413);

  const form = await request.formData().catch(() => null);
  if (!form) return error('The upload could not be read.', 400);
  const file = form.get('file');
  const purpose = form.get('purpose');
  if (!(file instanceof File) || !file.size || (purpose !== 'listing' && purpose !== 'issue')) {
    return error('Choose a photo and its purpose.', 400);
  }
  if (file.size > maxPhotoBytes) return error('Choose a photo under 8 MB.', 413);
  const format = await identifyPhoto(file);
  if (!format) return error('Use a JPEG, PNG or WebP photo.', 415);
  const note = purpose === 'issue' ? String(form.get('note') ?? '').trim().slice(0, 300) : '';

  const database = await db();
  const count = await listingPhotoCount(database, product);
  if (count === null) return error('Product not found.', 404);
  if (purpose === 'listing' && count >= maxProductPhotos) return error(listingPhotoLimitMessage, 409);

  const type = purpose === 'issue' ? 'authenticated' : 'upload';
  let asset;
  try {
    const uploaded = await uploadPhoto(file, format, type);
    asset = uploaded;
    const saved = await inventoryTransaction(connection => insertProductPhoto(connection, product, purpose, uploaded, note));
    if (saved) return Response.json({ saved: true }, { status: 201 });
    await discardPhoto(uploaded.publicId, type).catch(() => console.error('Unable to clean up unlinked Cloudinary photo.'));
    return error(listingPhotoLimitMessage, 409);
  } catch (cause) {
    if (asset) await discardPhoto(asset.publicId, type).catch(() => console.error('Unable to clean up unlinked Cloudinary photo.'));
    console.error('Product photo upload failed', cause instanceof Error ? cause.message : 'Unknown error');
    return error('The photo could not be saved. Check Cloudinary configuration and try again.', 502);
  }
}
