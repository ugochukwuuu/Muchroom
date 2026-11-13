import { randomBytes } from 'node:crypto';
import { isStaff } from '../../../../lib/auth';
import { identifyPhoto } from '../../../../lib/cloudinary';
import { geminiEnabled, scanProductPhoto } from '../../../../lib/gemini';
import { maxScanBytes } from '../../../../lib/product-scan';

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  if (!(await isStaff())) return error('Sign in to use AI fill.', 401);
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') return error('Invalid scan origin.', 403);
  if (!geminiEnabled()) return error('Set GEMINI_API_KEY to enable AI fill.', 503);
  if (Number(request.headers.get('content-length')) > maxScanBytes + 65536) return error('Choose a photo up to 4 MB.', 413);
  const form = await request.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File) || !file.size) return error('Choose a product photo.', 400);
  if (file.size > maxScanBytes) return error('Choose a photo up to 4 MB.', 413);
  const format = await identifyPhoto(file);
  if (!format) return error('Use a JPEG, PNG or WebP photo.', 415);
  try {
    const suggestions = await scanProductPhoto(file, format);
    const productCode = suggestions.name?.toUpperCase().replace(/[^A-Z0-9]+/g, '-')
      .slice(0, 32).replace(/^-|-$/g, '') || 'PRODUCT';
    const sku = Object.keys(suggestions).length
      ? `MR-${productCode}-${randomBytes(6).toString('hex').toUpperCase()}`
      : undefined;
    return Response.json({ suggestions, sku });
  } catch (cause) {
    console.error('Gemini product scan failed', cause instanceof Error ? cause.message : 'Unknown error');
    return error('Gemini couldn’t read the photo. Try again or enter the details manually.', 502);
  }
}
