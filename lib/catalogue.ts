import { db, type Connection } from './db';
import type { Variant } from './types';

export const reserved = `COALESCE((
  SELECT SUM(oi.quantity)::integer FROM order_items oi JOIN orders o ON o.id = oi.order_id
  WHERE oi.variant_id = v.id AND o.status = 'pending' AND o.expires_at > statement_timestamp()
), 0)`;

export async function catalogue(publicOnly = true, connection?: Connection) {
  const database = connection ?? await db();
  const { rows } = await database.query<Variant>(`
    SELECT v.*, p.name AS product, p.category, p.brand, p.description, p.image, p.published,
      ARRAY(SELECT photo.url FROM product_photos photo
        WHERE photo.product_id=p.id AND photo.purpose='listing'
        ORDER BY photo.is_cover DESC, photo.created_at, photo.id) AS images,
      GREATEST(v.quantity - ${reserved}, 0) AS available
    FROM variants v JOIN products p ON p.id = v.product_id
    ${publicOnly ? `WHERE p.published AND v.quantity > ${reserved}` : ''}
    ORDER BY p.name, v.price, v.sku
  `);
  return rows.map(row => ({ ...row, images: [...new Set([...row.images, row.image].filter(Boolean))] }));
}
