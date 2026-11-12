import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { Pool, type QueryResultRow } from 'pg';
import { schema } from './schema';
import { demoProducts, extraDemoProducts, soundcoreDemoPhotos } from './demo';

type Connection = { query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }> };
type Database = Connection & { transaction<T>(work: (connection: Connection) => Promise<T>): Promise<T> };
export const demoMode = !process.env.DATABASE_URL && process.env.NODE_ENV !== 'production';

async function connect(): Promise<Database> {
  let database: Database;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    database = {
      query: <T extends QueryResultRow>(sql: string, params?: unknown[]) => pool.query<T>(sql, params),
      async transaction(work) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await work({
            query: <T extends QueryResultRow>(sql: string, params?: unknown[]) => client.query<T>(sql, params),
          });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
    };
    // Coordinate schema setup across app instances.
    await database.transaction(async connection => {
      await connection.query('SELECT pg_advisory_xact_lock(4830271)');
      await connection.query(schema);
    });
  } else {
    if (!demoMode) throw new Error('DATABASE_URL is required in production.');
    const { PGlite: EmbeddedPostgres } = await import('@electric-sql/pglite');
    const directory = process.env.LOCAL_DATABASE_DIR || '.data/postgres';
    if (!directory.includes('://')) await mkdir(dirname(directory), { recursive: true });
    const postgres: PGlite = await EmbeddedPostgres.create(directory);
    await postgres.exec(schema);
    database = {
      query: (sql, params) => postgres.query(sql, params),
      transaction: work => postgres.transaction(connection => work(connection)),
    };
    await database.transaction(async connection => {
      await connection.query('CREATE TABLE IF NOT EXISTS demo_catalogue_updates (name text PRIMARY KEY)');
      const update = await connection.query(
        'INSERT INTO demo_catalogue_updates (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING name',
        ['extended-catalogue'],
      );
      if (!update.rows.length) return;
      const existing = await connection.query('SELECT id FROM products LIMIT 1');
      const entries = existing.rows.length ? extraDemoProducts : [...demoProducts, ...extraDemoProducts];
      for (const [name, brand, category, description, sku, label, price, quantity, specs, uses, image = ''] of entries) {
        const matching = await connection.query('SELECT id FROM variants WHERE sku = $1', [sku]);
        if (matching.rows.length) continue;
        const product = randomUUID();
        const variant = randomUUID();
        await connection.query('INSERT INTO products (id,name,brand,category,description,image,published) VALUES ($1,$2,$3,$4,$5,$6,true)', [product, name, brand, category, description, image]);
        await connection.query('INSERT INTO variants VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [variant, product, sku, label, price, quantity, JSON.stringify(specs), [...uses]]);
        if (quantity) await connection.query('INSERT INTO stock_movements (id,variant_id,change,reason,actor) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), variant, quantity, 'Opening stock', 'Demo seed']);
      }
    });
    await database.transaction(async connection => {
      const update = await connection.query(
        'INSERT INTO demo_catalogue_updates (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING name',
        ['soundcore-gallery'],
      );
      if (!update.rows.length) return;
      const { rows: [speaker] } = await connection.query<{ product_id: string }>(
        'SELECT product_id FROM variants WHERE sku=$1', ['SC-MOTION-BOOM'],
      );
      if (!speaker) return;
      for (const [index, url] of soundcoreDemoPhotos.entries()) {
        await connection.query(
          "INSERT INTO product_photos (id,product_id,purpose,url,format,is_cover) VALUES ($1,$2,'listing',$3,'jpg',$4)",
          [randomUUID(), speaker.product_id, url, index === 0],
        );
      }
    });
  }
  return database;
}

const shared = globalThis as typeof globalThis & { muchroomDatabase?: Promise<Database> };
export function db() {
  shared.muchroomDatabase ??= connect().catch(error => {
    delete shared.muchroomDatabase;
    throw error;
  });
  return shared.muchroomDatabase;
}

export async function inventoryTransaction<T>(work: (connection: Connection) => Promise<T>) {
  return (await db()).transaction(async connection => {
    await connection.query('SELECT id FROM inventory_lock WHERE id = 1 FOR UPDATE');
    return work(connection);
  });
}

export type { Connection };
