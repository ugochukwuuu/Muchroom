import { isStaff } from '../../../../../lib/auth';
import { downloadIssuePhoto, photoFormats } from '../../../../../lib/cloudinary';
import { db } from '../../../../../lib/db';
import { uuidPattern } from '../../../../../lib/types';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isStaff())) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return new Response(null, { status: 404 });
  const { rows: [photo] } = await (await db()).query<{ public_id: string; format: keyof typeof photoFormats }>(
    "SELECT public_id,format FROM product_photos WHERE id=$1 AND purpose='issue'", [id],
  );
  if (!photo) return new Response(null, { status: 404 });
  try {
    const source = await downloadIssuePhoto(photo.public_id, photo.format);
    if (!source.ok) return new Response(null, { status: 502 });
    return new Response(source.body, {
      headers: { 'Content-Type': photoFormats[photo.format], 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
