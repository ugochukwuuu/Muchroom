import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Resolve TypeScript's extensionless local imports when testing directly in Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('.ts') && !context.parentURL.includes('/node_modules/')
      && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
});
delete process.env.DATABASE_URL;
process.env.LOCAL_DATABASE_DIR = 'memory://';

const { catalogue } = await import('../lib/catalogue.ts');
const { db, inventoryTransaction } = await import('../lib/db.ts');
const { confirmPayment, createOrder, lookupOrder, movement } = await import('../lib/orders.ts');
const { describePrice, interpret, recommend } = await import('../lib/recommender.ts');
const { identifyPhoto, uploadPhoto, downloadIssuePhoto } = await import('../lib/cloudinary.ts');
const { scanProductPhoto } = await import('../lib/gemini.ts');
const { insertProductPhoto, listingPhotoCount } = await import('../lib/product-photos.ts');

test('Gemini scans a photo and returns only allowed product suggestions', async t => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });
  const photo = new File([Uint8Array.of(255, 216, 255, 224)], 'photo.jpg', { type: 'image/jpeg' });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    const payload = JSON.parse(options.body);
    assert.equal(payload.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
    assert.equal(payload.generationConfig.responseMimeType, 'application/json');
    return Response.json({ candidates: [{ content: { parts: [
      { text: 'Internal reasoning', thought: true },
      { text: JSON.stringify({ name: '  ThinkPad  ', brand: 'Lenovo', category: 'Unknown', price: '100', quantity: '5', sku: 'guessed', specs: '' }) },
    ] } }] });
  });
  assert.deepEqual(await scanProductPhoto(photo, 'jpg'), { name: 'ThinkPad', brand: 'Lenovo' });
});

test('a product gallery keeps the legacy photo, honours its cover and excludes private issue photos', async () => {
  const speaker = (await catalogue()).find(item => item.sku === 'SC-MOTION-BOOM');
  assert.equal(speaker.images.length, 3);
  assert.equal(speaker.images[0], speaker.image);
  const database = await db();
  const alternate = speaker.images[1];
  await database.query("UPDATE product_photos SET is_cover=(url=$2) WHERE product_id=$1 AND purpose='listing'", [speaker.product_id, alternate]);
  await database.query("INSERT INTO product_photos (id,product_id,purpose,public_id,format,note) VALUES ($1,$2,'issue',$3,'jpg',$4)",
    [randomUUID(), speaker.product_id, 'test/private-photo', 'Private damage note']);
  const updated = (await catalogue()).find(item => item.id === speaker.id);
  assert.equal(updated.images[0], alternate);
  assert.equal(updated.images.length, 3);
  assert.doesNotMatch(JSON.stringify(updated), /private-photo|Private damage note/);
});

test('listing photos are capped at three distinct images, including the image URL', async () => {
  const id = randomUUID();
  await inventoryTransaction(async connection => {
    assert.equal(await listingPhotoCount(connection, id), null);
    const legacy = '/example.jpg';
    await connection.query('INSERT INTO products VALUES ($1,$2,$3,$4,$5,$6,false)', [id, 'Example', 'Example', 'Laptops', 'Example', legacy]);
    const asset = (url, publicId) => ({ url, publicId, format: 'jpg' });
    await insertProductPhoto(connection, id, 'listing', asset(legacy, 'test/legacy'));
    assert.equal(await insertProductPhoto(connection, id, 'listing', asset('/second.jpg', 'test/second')), true);
    assert.equal(await insertProductPhoto(connection, id, 'listing', asset('/third.jpg', 'test/third')), true);
    assert.equal(await insertProductPhoto(connection, id, 'listing', asset('/fourth.jpg', 'test/fourth')), false);
    assert.equal(await insertProductPhoto(connection, id, 'issue', asset(null, 'test/issue')), true);
    assert.equal(await listingPhotoCount(connection, id), 3);
  });
});

test('issue uploads and downloads use signed authenticated Cloudinary requests', async t => {
  const values = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' };
  const original = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const photo = new File([Uint8Array.of(255, 216, 255, 224)], 'photo.jpg', { type: 'image/jpeg' });
  assert.equal(await identifyPhoto(photo), 'jpg');
  assert.equal(await identifyPhoto(new File(['not an image'], 'fake.jpg')), null);
  const verifySignature = (fields) => {
    const payload = [...fields].filter(([key]) => !['file', 'api_key', 'signature'].includes(key))
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('&');
    assert.equal(fields.get('signature'), createHash('sha256').update(payload + values.CLOUDINARY_API_SECRET).digest('hex'));
    assert.equal(fields.get('type'), 'authenticated');
    assert.equal(fields.get('api_key'), values.CLOUDINARY_API_KEY);
  };
  const provider = t.mock.method(globalThis, 'fetch', async (url, options) => {
    const requestUrl = new URL(url);
    if (requestUrl.pathname.endsWith('/upload')) {
      verifySignature(options.body);
      return Response.json({ public_id: options.body.get('public_id'), type: 'authenticated', format: 'jpg', secure_url: 'https://res.cloudinary.com/example' });
    }
    assert.match(requestUrl.pathname, /\/image\/download$/);
    verifySignature(requestUrl.searchParams);
    return new Response(photo);
  });
  const uploaded = await uploadPhoto(photo, 'jpg', 'authenticated');
  assert.equal(uploaded.url, null);
  assert.equal((await downloadIssuePhoto(uploaded.publicId, uploaded.format)).ok, true);
  assert.equal(provider.mock.callCount(), 2);
});

test('a follow-up preserves intent and enforces availability, budget and use', async () => {
  const products = await catalogue(false);
  const initial = interpret('Laptop for coding under ₦400k', {}, []);
  assert.deepEqual(recommend(products, initial).map(match => match.variant.sku), ['LAT-5420-16', 'TP-T14-16']);
  const changed = interpret('make it ₦350k', initial, []);
  assert.deepEqual(changed, { category: 'Laptops', price: { max: { amount: 350000, inclusive: true } }, use: 'Coding' });
  assert.deepEqual(recommend(products, changed).map(match => match.variant.sku), ['LAT-5420-16']);
  assert.deepEqual(recommend(products, interpret('Laptop with 32 GB RAM under ₦400k', {}, [])), []);
  assert.deepEqual(recommend(products, interpret('Mouse', {}, [])), []);
});

test('price floors, ceilings and ranges filter the catalogue in the requested direction', async () => {
  const products = await catalogue(false);
  const above = interpret('I need a laptop for coding above 500k', {}, []);
  assert.deepEqual(describePrice(above.price), ['Above ₦500,000']);
  assert.deepEqual(recommend(products, above).map(match => match.variant.sku), ['TP-T14-G3-AMD-16', 'MBA-M1-8-256']);
  const matchingSkus = (query) => recommend(products, interpret(query, {}, [])).map(match => match.variant.sku);
  assert.deepEqual(matchingSkus('Laptop for coding over 325000'), ['TP-T14-16', 'TP-T14-G3-AMD-16', 'MBA-M1-8-256']);
  assert.deepEqual(matchingSkus('Laptop for coding at least ₦389k'), ['TP-T14-16', 'TP-T14-G3-AMD-16', 'MBA-M1-8-256']);
  assert.deepEqual(matchingSkus('Laptop for coding under ₦389,000'), ['LAT-5420-16']);
  assert.deepEqual(matchingSkus('Laptop for coding up to ₦389k'), ['LAT-5420-16', 'TP-T14-16']);
  assert.deepEqual(matchingSkus('Laptop for coding between ₦325k and ₦350k'), ['LAT-5420-16']);
  assert.deepEqual(matchingSkus('Laptop for coding above ₦325k and below ₦400k'), ['TP-T14-16']);
  assert.deepEqual(matchingSkus('Laptop for coding with at least 16 GB RAM'), ['LAT-5420-16', 'TP-T14-16', 'TP-T14-G3-AMD-16']);
  assert.deepEqual(matchingSkus('Laptop for coding above ₦1m'), []);
});

test('one checkout claims the last unit, and duplicate payment does not deduct it again', async () => {
  const mouse = (await catalogue(false)).find(variant => variant.sku === 'LOG-M185');
  await inventoryTransaction(connection => movement(connection, mouse.id, 1, 'Received stock', 'Test'));
  const lines = [{ id: mouse.id, quantity: 1 }];
  const purchase = { channel: 'online', payment: 'Demo', method: 'pickup', customer: 'Test', lines };
  const competing = await Promise.allSettled([createOrder(purchase), createOrder(purchase)]);
  assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
  const { id, total } = competing.find(result => result.status === 'fulfilled').value;
  assert.equal((await catalogue()).some(item => item.id === mouse.id), false);
  await assert.rejects(createOrder({ ...purchase, channel: 'in_store', payment: 'Cash' }), /enough available stock/);
  await Promise.all([confirmPayment(id, total, id), confirmPayment(id, total, id)]);
  assert.equal((await lookupOrder(id)).order.status, 'paid');
  assert.equal((await catalogue(false)).find(item => item.id === mouse.id).quantity, 0);
  const history = await (await db()).query('SELECT change FROM stock_movements WHERE order_id=$1', [id]);
  assert.deepEqual(history.rows, [{ change: -1 }]);
  await inventoryTransaction(connection => movement(connection, mouse.id, 3, 'Count correction', 'Test'));
  assert.equal((await catalogue()).find(item => item.id === mouse.id).available, 3);
});

test('expiry releases stock, and late payment goes to review', async () => {
  const projector = (await catalogue()).find(item => item.category === 'Projectors');
  const order = await createOrder({
    channel: 'online', payment: 'Demo', method: 'pickup', customer: 'Test',
    lines: [{ id: projector.id, quantity: projector.available }],
  });
  const database = await db();
  await database.query("UPDATE orders SET expires_at=now() - interval '1 second' WHERE id=$1", [order.id]);
  assert.equal((await catalogue()).find(item => item.id === projector.id).available, projector.available);
  await confirmPayment(order.id, order.total, order.id);
  assert.equal((await lookupOrder(order.id)).order.status, 'review');
  assert.equal((await catalogue()).find(item => item.id === projector.id).available, projector.available);
});

test('a walk-in sale is paid and fulfilled and removes the last unit from the storefront', async () => {
  const speaker = (await catalogue()).find(item => item.sku === 'JBL-FLIP6');
  const { id, total } = await createOrder({
    channel: 'in_store', payment: 'Cash', method: 'walk-in', customer: 'Test',
    lines: [{ id: speaker.id, quantity: speaker.available }],
  });
  const sale = await lookupOrder(id);
  assert.equal(sale.order.status, 'paid');
  assert.equal(sale.order.fulfilment, 'fulfilled');
  assert.equal(total, speaker.price * speaker.available);
  assert.equal((await catalogue()).some(item => item.id === speaker.id), false);
  assert.equal((await catalogue(false)).find(item => item.id === speaker.id).quantity, 0);
});
