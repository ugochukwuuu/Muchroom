import { randomUUID } from 'node:crypto';
import { db, type Connection } from './db';
import { maxProductPhotos } from './types';

export const listingPhotoLimitMessage = `A listing can have up to ${maxProductPhotos} photos.`;
export type PhotoPurpose = 'listing' | 'issue';
export type ProductPhotoRecord = {
  id: string;
  purpose: PhotoPurpose;
  url: string | null;
  note: string;
  is_cover: boolean;
};

export async function listingPhotoCount(connection: Connection, product: string) {
  const { rows } = await connection.query<{ count: number }>(`
    SELECT count(*)::integer AS count FROM (
      SELECT url FROM product_photos WHERE product_id=$1 AND purpose='listing' AND url IS NOT NULL AND url<>''
      UNION SELECT image FROM products WHERE id=$1 AND image<>''
    ) AS listing_images
    HAVING EXISTS (SELECT 1 FROM products WHERE id=$1)
  `, [product]);
  return rows[0]?.count ?? null;
}

export async function insertProductPhoto(connection: Connection, product: string, purpose: PhotoPurpose,
  asset: { url: string | null; publicId: string; format: string }, note = '') {
  if (purpose === 'listing') {
    const count = await listingPhotoCount(connection, product);
    if (count === null || count >= maxProductPhotos) return false;
  }
  const result = await connection.query(`
    INSERT INTO product_photos (id,product_id,purpose,url,public_id,format,note,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,clock_timestamp())
    RETURNING id
  `, [randomUUID(), product, purpose, asset.url, asset.publicId, asset.format, note]);
  return result.rows.length > 0;
}

export async function productPhotos(id: string) {
  const { rows } = await (await db()).query<ProductPhotoRecord>(`
    SELECT id, purpose, url, note, is_cover FROM product_photos
    WHERE product_id=$1 ORDER BY is_cover DESC, created_at, id
  `, [id]);
  return rows;
}
