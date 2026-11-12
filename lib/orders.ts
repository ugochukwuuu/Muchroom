import { randomUUID } from 'node:crypto';
import { catalogue } from './catalogue';
import { db, inventoryTransaction, type Connection } from './db';
import { uuidPattern, type Order } from './types';

type CartLine = { id: string; quantity: number };
type Item = { variant_id: string; quantity: number; label: string; price: number };
type Purchase = {
  channel: Order['channel']; method: string; payment: string; customer: string; email?: string;
  phone?: string; address?: string; location?: string; source?: string; lines: CartLine[];
  deliveryFee?: number;
};

export class InputError extends Error {}

export async function movement(connection: Connection, variant: string, change: number, reason: string, actor: string, order?: string) {
  if (change === 0) return;
  await connection.query(`UPDATE variants SET quantity = quantity + $2 WHERE id = $1`, [variant, change]);
  await connection.query(
    'INSERT INTO stock_movements (id,variant_id,order_id,change,reason,actor) VALUES ($1,$2,$3,$4,$5,$6)',
    [randomUUID(), variant, order ?? null, change, reason, actor],
  );
}

export async function createOrder(input: Purchase) {
  if (!input.lines.length || input.lines.length > 30) throw new InputError('Add at least one item to the order.');
  const requested = new Map<string, number>();
  for (const { id, quantity } of input.lines) {
    if (!uuidPattern.test(id) || !Number.isSafeInteger(quantity) || quantity < 1) throw new InputError('Check the quantities and try again.');
    const total = (requested.get(id) ?? 0) + quantity;
    if (total > 99) throw new InputError('The maximum is 99 units per item.');
    requested.set(id, total);
  }
  return inventoryTransaction(async connection => {
    const variants = await catalogue(input.channel === 'online', connection);
    const items = [...requested].map(([id, quantity]) => {
      const variant = variants.find(row => row.id === id);
      if (!variant || variant.available < quantity) throw new InputError('An item no longer has enough available stock. Check your quantities.');
      return { variant, quantity };
    });
    const id = randomUUID();
    const total = items.reduce((sum, item) => sum + item.quantity * item.variant.price, input.deliveryFee ?? 0);
    if (total > 2147483647) throw new InputError('The order total exceeds the supported amount.');
    const inStore = input.channel === 'in_store';
    await connection.query(`
      INSERT INTO orders (id,channel,status,fulfilment,payment_method,customer,email,phone,method,address,location,source,total,delivery_fee,expires_at,paid_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
        CASE WHEN $3 = 'pending' THEN now() + interval '20 minutes' END,
        CASE WHEN $3 = 'paid' THEN now() END)
    `, [id, input.channel, inStore ? 'paid' : 'pending', inStore ? 'fulfilled' : 'unfulfilled',
      input.payment, input.customer, input.email ?? '', input.phone ?? '', input.method, input.address ?? '',
      input.location ?? '', input.source ?? '', total, input.deliveryFee ?? 0]);
    for (const { variant, quantity } of items) {
      await connection.query('INSERT INTO order_items VALUES ($1,$2,$3,$4,$5)',
        [id, variant.id, `${variant.product} · ${variant.name}`, quantity, variant.price]);
      if (inStore) await movement(connection, variant.id, -quantity, 'Sale', 'Shop staff', id);
    }
    return { id, total };
  });
}

export async function confirmPayment(id: string, amount: number, reference: string) {
  if (!uuidPattern.test(id)) return;
  await inventoryTransaction(async connection => {
    const { rows: [order] } = await connection.query<Order & { active: boolean }>(
      'SELECT *, expires_at > statement_timestamp() AS active FROM orders WHERE id = $1', [id],
    );
    if (!order || order.channel !== 'online' || order.total !== amount || order.status === 'paid' || order.status === 'review') return;
    await connection.query('INSERT INTO payments (reference,order_id,amount) VALUES ($1,$2,$3)', [reference, id, amount]);
    if (order.status !== 'pending' || !order.active) {
      await connection.query("UPDATE orders SET status = 'review' WHERE id = $1", [id]);
      return;
    }
    const { rows } = await connection.query<Item>('SELECT * FROM order_items WHERE order_id = $1', [id]);
    for (const item of rows) await movement(connection, item.variant_id, -item.quantity, 'Sale', order.payment_method, id);
    await connection.query("UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1", [id]);
  });
}

export async function lookupOrder(id: string) {
  if (!uuidPattern.test(id)) return null;
  const database = await db();
  const { rows: [order] } = await database.query<Order>('SELECT * FROM orders WHERE id = $1', [id]);
  if (!order) return null;
  const { rows: items } = await database.query<Item>('SELECT * FROM order_items WHERE order_id = $1 ORDER BY label', [id]);
  return { order, items };
}
