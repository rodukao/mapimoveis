# Photo upload update — 2026-09-06

Applied Supabase migrations via the connector: fix_terra_photo_paths_and_atomic_sync; enforce_twelve_photo_slots_per_listing. SQL recorded in photo-upload-fix.sql. Existing listings and users preserved.

Verified: authenticated transaction inserts 12 metadata rows, replaces one while compacting ordering, rejects a stale photo set, and rolls back all test records. Confirmed the bucket is public, limited to 10 MiB per file and JPEG/PNG/WebP. Confirmed the deferred unique listing/slot constraint is installed. JavaScript syntax checks and 13 adapter tests pass, including upload failure and metadata failure recovery.

No live browser upload was performed. Public bucket URLs can be viewed by anyone who has them, including images attached to drafts; catalog metadata remains governed by listing RLS. Storage cleanup failures are logged and can leave unreferenced objects for later cleanup.

Production follow-up from Supabase advisors: review existing PostGIS in public and spatial_ref_sys grants/RLS, exposed SECURITY DEFINER routines (rls_auto_enable and st_estimatedextent), and leaked-password protection. These pre-existing configuration findings were not changed in this photo update. Custom SMTP remains unconfigured.

References:
- https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
