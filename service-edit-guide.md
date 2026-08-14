# Service-wise actual editing

Every service has its own real working config under services/<service-name>/config.js.

Editing that config changes the service shown on the homepage and the service-specific form that opens from the existing service card.

You can edit:
- service name/category/description
- form fields
- required/optional uploads
- dropdown options

The existing backend/Supabase request flow in js/app.js is kept intact.

To add a new service, copy any service folder, rename it, edit its config.js, and add its config path to services/manifest.js.
