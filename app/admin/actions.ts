'use server';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { isStaff, requireStaff, signIn, signOut } from '../../lib/auth';
import { db, inventoryTransaction } from '../../lib/db';
import { catalogue } from '../../lib/catalogue';
import { createOrder, InputError, movement } from '../../lib/orders';
import { categories, maxProductPhotos, uuidPattern } from '../../lib/types';
import { discardPhoto, identifyPhoto, photoUploadsEnabled, uploadPhoto } from '../../lib/cloudinary';
import { insertProductPhoto, listingPhotoCount, listingPhotoLimitMessage } from '../../lib/product-photos';
import { maxScanBytes } from '../../lib/product-scan';

const field = (form: FormData, key: string, max = 100) => String(form.get(key) ?? '').trim().slice(0, max);
const number = (form: FormData, key: string, min = 0, max = 1000000) => {
  const raw = field(form, key);
  const value = Number(raw);
  if (!raw || !Number.isSafeInteger(value) || value < min || value > max) throw new InputError(`Enter a valid ${key}.`);
  return value;
};
const identifier = (form: FormData, key: string) => {
  const id = field(form, key);
  if (!uuidPattern.test(id)) throw new InputError('Select a valid record.');
  return id;
};

async function adminAction(next: string, work: () => Promise<unknown>) {
  await requireStaff();
  try { await work(); } catch (error) {
    if (!(error instanceof InputError) && (error as { code?: string }).code !== '23505') console.error('Staff operation failed', error);
    const message = error instanceof InputError ? error.message : (error as { code?: string }).code === '23505' ? 'That SKU is already in use.' : 'The change could not be saved.';
    redirect(`${next}?error=${encodeURIComponent(message)}`);
  }
  redirect(`${next}?saved=1`);
}

export async function staffLogin(form: FormData) {
  if (await isStaff()) redirect('/admin');
  if (await signIn(field(form, 'password', 250))) redirect('/admin');
  redirect('/admin/login?invalid=1');
}

export async function staffLogout() {
  await signOut();
  redirect('/admin/login');
}

export async function saveProduct(form: FormData) {
  const rawId = field(form, 'product');
  const next = uuidPattern.test(rawId) ? `/admin/inventory/${rawId}` : '/admin/inventory';
  await adminAction(next, async () => {
    const name = field(form, 'name');
    const brand = field(form, 'brand');
    const category = field(form, 'category');
    const description = field(form, 'description', 2000);
    const image = field(form, 'image', 500);
    const published = form.get('published') === 'on';
    if (!name || !brand || !description || !categories.some(value => value === category)) throw new InputError('Enter a name, brand, category and description.');
    if (image && !/^https:\/\/[^\s]+$/i.test(image) && !/^\/(?!\/)[\w./-]+$/.test(image)) throw new InputError('Use an HTTPS image URL.');
    const id = rawId ? identifier(form, 'product') : randomUUID();
    const photos = form.getAll('listingPhoto').filter((photo): photo is File => photo instanceof File && photo.size > 0);
    if (photos.length > maxProductPhotos) throw new InputError(listingPhotoLimitMessage);
    if (photos.length && !photoUploadsEnabled()) throw new InputError('Configure Cloudinary before attaching photos.');
    const files = await Promise.all(photos.map(async photo => {
      if (photo.size > maxScanBytes) throw new InputError('Choose photos up to 4 MB each.');
      const format = await identifyPhoto(photo);
      if (!format) throw new InputError('Use a JPEG, PNG or WebP photo.');
      return { photo, format };
    }));
    const assets: Awaited<ReturnType<typeof uploadPhoto>>[] = [];
    try {
      try {
        for (const { photo, format } of files) assets.push(await uploadPhoto(photo, format, 'upload'));
      } catch {
        throw new InputError('The photos could not be uploaded. Try again or save without attaching them.');
      }
      await inventoryTransaction(async connection => {
        if (rawId) {
          const { rows: [existing] } = await connection.query<{ image: string }>('SELECT image FROM products WHERE id=$1', [id]);
          if (!existing) throw new InputError('Product not found.');
          await connection.query('UPDATE products SET name=$2,brand=$3,category=$4,description=$5,image=$6,published=$7 WHERE id=$1',
            [id, name, brand, category, description, image, published]);
          if (image && image !== existing.image && (await listingPhotoCount(connection, id) ?? 0) > maxProductPhotos) {
            throw new InputError(listingPhotoLimitMessage);
          }
        } else {
          await connection.query('INSERT INTO products VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, name, brand, category, description, image, published]);
          await writeVariant(connection, id, form);
        }
        for (const asset of assets) {
          if (!(await insertProductPhoto(connection, id, 'listing', asset))) throw new InputError(listingPhotoLimitMessage);
        }
      });
    } catch (error) {
      await Promise.all(assets.map(asset => discardPhoto(asset.publicId, 'upload').catch(() => console.error('Unable to clean up unlinked Cloudinary photo.'))));
      throw error;
    }
  });
}

async function writeVariant(connection: import('../../lib/db').Connection, product: string, form: FormData) {
  const rawId = field(form, 'variant');
  const id = rawId ? identifier(form, 'variant') : randomUUID();
  const name = field(form, 'variant name');
  const sku = field(form, 'sku');
  const price = number(form, 'price', 1, 100000000);
  const uses = [...new Set(field(form, 'uses', 300).split(',').map(use => use.trim()).filter(Boolean))];
  const specs: Record<string, string> = Object.fromEntries(field(form, 'specs', 2000).split('\n').filter(line => line.includes(':')).map(line => {
    const index = line.indexOf(':');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }).filter(([key, value]) => key && value));
  if (!name || !sku) throw new InputError('Enter a variant name and SKU.');
  if (rawId) {
    const updated = await connection.query('UPDATE variants SET sku=$3,name=$4,price=$5,specs=$6,uses=$7 WHERE id=$1 AND product_id=$2 RETURNING id',
      [id, product, sku, name, price, JSON.stringify(specs), uses]);
    if (!updated.rows.length) throw new InputError('Variant could not be found.');
  } else {
    const quantity = number(form, 'quantity', 0, 1000000);
    await connection.query('INSERT INTO variants (id,product_id,sku,name,price,specs,uses) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, product, sku, name, price, JSON.stringify(specs), uses]);
    await movement(connection, id, quantity, 'Opening stock', 'Shop staff');
  }
}

export async function saveVariant(form: FormData) {
  const rawId = field(form, 'product');
  await adminAction(uuidPattern.test(rawId) ? `/admin/inventory/${rawId}` : '/admin/inventory', async () => {
    await inventoryTransaction(connection => writeVariant(connection, identifier(form, 'product'), form));
  });
}

export async function makeListingCover(form: FormData) {
  const rawId = field(form, 'product');
  await adminAction(uuidPattern.test(rawId) ? `/admin/inventory/${rawId}` : '/admin/inventory', async () => {
    const product = identifier(form, 'product');
    const photo = identifier(form, 'photo');
    await inventoryTransaction(async connection => {
      const found = await connection.query("SELECT id FROM product_photos WHERE product_id=$1 AND id=$2 AND purpose='listing'", [product, photo]);
      if (!found.rows.length) throw new InputError('Listing photo not found.');
      await connection.query("UPDATE product_photos SET is_cover=(id=$2) WHERE product_id=$1 AND purpose='listing'", [product, photo]);
    });
  });
}

export async function removeListingPhoto(form: FormData) {
  const rawId = field(form, 'product');
  await adminAction(uuidPattern.test(rawId) ? `/admin/inventory/${rawId}` : '/admin/inventory', async () => {
    await inventoryTransaction(async connection => {
      const product = identifier(form, 'product');
      const deleted = await connection.query<{ url: string }>("DELETE FROM product_photos WHERE product_id=$1 AND id=$2 AND purpose='listing' RETURNING url",
        [product, identifier(form, 'photo')]);
      if (!deleted.rows.length) throw new InputError('Listing photo not found.');
      await connection.query("UPDATE products SET image='' WHERE id=$1 AND image=$2", [product, deleted.rows[0].url]);
    });
  });
}

export async function updateStock(form: FormData) {
  const rawId = field(form, 'product');
  await adminAction(uuidPattern.test(rawId) ? `/admin/inventory/${rawId}` : '/admin/inventory', async () => {
    const id = identifier(form, 'variant');
    const mode = field(form, 'mode');
    const amount = number(form, 'quantity', mode === 'receive' ? 1 : 0);
    const note = field(form, 'note', 200);
    if (!['receive', 'count'].includes(mode)) throw new InputError('Choose a stock action.');
    if (mode === 'count' && !note) throw new InputError('Add a reason for the count correction.');
    await inventoryTransaction(async connection => {
      const variant = (await catalogue(false, connection)).find(item => item.id === id);
      if (!variant) throw new InputError('Variant could not be found.');
      const quantity = mode === 'receive' ? variant.quantity + amount : amount;
      if (quantity > 1000000) throw new InputError('Stock exceeds the supported quantity.');
      if (quantity < variant.quantity - variant.available) throw new InputError('The new count is below units held for checkout. Review pending orders first.');
      const label = mode === 'receive' ? 'Received stock' : 'Count correction';
      await movement(connection, id, quantity - variant.quantity, note ? `${label} · ${note}` : label, 'Shop staff');
    });
  });
}

export async function recordSale(form: FormData) {
  await adminAction('/admin/orders', async () => {
    const payment = field(form, 'payment');
    if (!['Cash', 'Card', 'Bank transfer'].includes(payment)) throw new InputError('Select a payment method.');
    const ids = form.getAll('variant');
    const quantities = form.getAll('quantity');
    const lines = ids.flatMap((id, index) => id ? [{ id: String(id), quantity: Number(quantities[index]) }] : []);
    await createOrder({
      channel: 'in_store', method: 'walk-in', payment, customer: field(form, 'customer') || 'Walk-in customer',
      location: 'Nsukka', source: field(form, 'source', 80), lines,
    });
  });
}

export async function fulfilOrder(form: FormData) {
  await adminAction('/admin/orders', async () => {
    const database = await db();
    const result = await database.query("UPDATE orders SET fulfilment='fulfilled' WHERE id=$1 AND status='paid' RETURNING id", [identifier(form, 'order')]);
    if (!result.rows.length) throw new InputError('Only paid orders can be fulfilled.');
  });
}
