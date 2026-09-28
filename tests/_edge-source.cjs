// terra-billing, terra-billing-webhook and terra-operations import shared helpers from
// ../_shared/http.ts (a real ES module, resolved fine by Deno at deploy time). The test
// files eval an Edge Function's source with vm.runInContext, which only runs plain
// scripts — no ES `import`. This inlines the shared module ahead of the function body
// and rewrites its aliased import into plain const bindings, the same "strip export
// for a non-module context" trick scripts/build-site.cjs already uses to bundle
// server/site-worker.mjs into the Worker.
const fs = require('node:fs');
function loadEdgeSource(name) {
 const shared = fs.readFileSync('supabase/functions/_shared/http.ts', 'utf8').replace(/^export /gm, '');
 const aliases = 'const key=envKey,request=fetchTimeout,buildAdminHeaders=adminHeaders;\n';
 // [\s\S]*? (not [^}]*) so a Prettier-wrapped multi-line import still matches.
 const main = fs.readFileSync(`supabase/functions/${name}/index.ts`, 'utf8').replace(/^import\s*\{[\s\S]*?\}\s*from\s*'\.\.\/_shared\/http\.ts';\r?\n/m, '');
 return shared + '\n' + aliases + main;
}
module.exports = { loadEdgeSource };
