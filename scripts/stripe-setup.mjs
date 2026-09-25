// One-off, idempotent setup: creates (or reuses) the Stripe Products/Prices and webhook
// endpoint this project needs, then prints the values to paste into Supabase secrets.
// Run with: STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
const SUPABASE_PROJECT_URL = 'https://pkofzhlcbqupanzydyyf.supabase.co';
const WEBHOOK_URL = SUPABASE_PROJECT_URL + '/functions/v1/terra-billing-webhook';
const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) { console.error('Defina STRIPE_SECRET_KEY no ambiente antes de rodar este script.'); process.exit(1); }

function form(fields) {
  const params = new URLSearchParams();
  const add = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => add(key + '[' + i + ']', v));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) add(key + '[' + k + ']', v);
    else params.append(key, String(value));
  };
  for (const [k, v] of Object.entries(fields)) add(k, v);
  return params;
}
async function stripeGet(path) {
  const r = await fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Basic ' + Buffer.from(secretKey + ':').toString('base64') } });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || ('GET ' + path + ' failed'));
  return data;
}
async function stripePost(path, fields) {
  const r = await fetch('https://api.stripe.com/v1/' + path, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(secretKey + ':').toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(fields) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || ('POST ' + path + ' failed'));
  return data;
}

// Reuses an existing active Price with this lookup_key if one exists; otherwise creates
// a fresh Product + Price pair. Safe to rerun — never creates duplicates.
async function findOrCreatePrice(lookupKey, productName, priceFields) {
  const existing = await stripeGet('prices?lookup_keys[]=' + encodeURIComponent(lookupKey) + '&active=true');
  if (existing.data.length) { console.log(`✓ Price "${lookupKey}" já existe (${existing.data[0].id}), reaproveitando.`); return existing.data[0]; }
  const product = await stripePost('products', { name: productName });
  const price = await stripePost('prices', { ...priceFields, product: product.id, lookup_key: lookupKey, currency: 'brl' });
  console.log(`✓ Criado produto "${productName}" e price ${price.id} (${lookupKey}).`);
  return price;
}

async function findOrCreateWebhook() {
  const existing = await stripeGet('webhook_endpoints?limit=100');
  const found = existing.data.find(e => e.url === WEBHOOK_URL);
  if (found) { console.log('✓ Webhook endpoint já existe — o STRIPE_WEBHOOK_SECRET atual continua válido (Stripe não reexibe o segredo de um endpoint existente).'); return null; }
  const endpoint = await stripePost('webhook_endpoints', { url: WEBHOOK_URL, enabled_events: ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'] });
  console.log('✓ Criado webhook endpoint ' + endpoint.id + '.');
  return endpoint.secret;
}

const plus = await findOrCreatePrice('terramapa_plus_monthly', 'TerraMapa Plus', { unit_amount: 2900, recurring: { interval: 'month' } });
const pro = await findOrCreatePrice('terramapa_pro_monthly', 'TerraMapa Pro', { unit_amount: 7900, recurring: { interval: 'month' } });
const boost = await findOrCreatePrice('terramapa_boost_7d', 'TerraMapa Impulsionamento (7 dias)', { unit_amount: 1490 });
const webhookSecret = await findOrCreateWebhook();

console.log('\nCole estes valores em Supabase → Edge Functions → Secrets:\n');
console.log('STRIPE_SECRET_KEY=' + secretKey);
console.log('STRIPE_PRICE_PLUS=' + plus.id);
console.log('STRIPE_PRICE_PRO=' + pro.id);
console.log('STRIPE_PRICE_BOOST=' + boost.id);
if (webhookSecret) console.log('STRIPE_WEBHOOK_SECRET=' + webhookSecret);
else console.log('STRIPE_WEBHOOK_SECRET=<mantenha o valor já configurado — o endpoint já existia>');
