# Shared Admin -> Customer site configuration

The Admin service/form/tool editor is now synced through Supabase, so changes made in Admin are visible on the customer homepage on every device/browser.

## One-time setup
1. Open your Supabase project.
2. Go to SQL Editor.
3. Open `supabase/site_config.sql` from this ZIP.
4. Run the complete SQL once.
5. Deploy this ZIP to Netlify.
6. Hard-refresh the customer homepage (`Ctrl + Shift + R`).

After this, Admin -> Services & Forms and Admin -> Tools / Links use the shared `site_config` row. The browser localStorage remains only as a fallback.
