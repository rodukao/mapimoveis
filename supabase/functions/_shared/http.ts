// Shared by terra-billing, terra-billing-webhook and terra-operations: the same
// secret-key lookup, timeout-guarded fetch and admin-header shape were copy-pasted
// identically across those three functions. Not used by terra-contact, terra-rayx or
// terra-storage-cleanup — their surrounding code differs enough that sharing this
// would cost more clarity than the duplication it removes.
// No type annotations, matching every other function in this project (plain JS run
// through Deno's .ts loader) — tests/_edge-source.cjs evals this with the plain JS
// engine (vm.runInContext), which cannot parse TypeScript syntax.

// Supabase can hand out a key set as JSON ({"default": "..."}) or as a single legacy
// env var; try the JSON form first, fall back to the legacy name.
export function envKey(jsonName, legacy) {
  const value = Deno.env.get(jsonName);
  return (value ? JSON.parse(value).default : null) || Deno.env.get(legacy);
}

export async function fetchTimeout(url, options = {}, ms = 15000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
}

// New publishable/secret keys (sb_publishable_/sb_secret_) are sent as `apikey` alone;
// legacy JWT-shaped keys (eyJ...) also need the Authorization bearer header.
export function adminHeaders(secret) {
  return { apikey: secret, 'Content-Type': 'application/json', ...(secret.startsWith('eyJ') ? { Authorization: 'Bearer ' + secret } : {}) };
}

export function corsHeaders(allowedOrigins, origin) {
  const base = { 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  return { ...base, ...(origin && allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) };
}
