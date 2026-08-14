# Knowledge World Online — CSC Website

A complete front-end website for a Common Service Center (CSC) / cyber cafe named
**Knowledge World Online**, based in Palitana, Gujarat.

## What's included

- `index.html` — Home page: animated hero, 30+ services grid with category filters
  where **every service card is clickable and opens a real request form** (name,
  mobile, notes, optional document upload) that instantly generates a token —
  same as the dedicated "Print & Xerox" file-upload widget (PDF/JPG/PNG, name +
  mobile number, no login required), plus process steps, about section, contact section.
- `login.html` / `register.html` — Customer login and registration.
- `dashboard.html` — Logged-in customer area: request history, live status, file re-download.
- `admin-login.html` / `admin-dashboard.html` — Staff login and admin panel that lists
  **every** registered customer and **every** print/xerox & service request, with file
  download, status updates (Pending → In Progress → Ready → Collected), search and delete.
- `css/style.css` — All styling (single stylesheet, fully responsive).
- `js/app.js` — Shared data layer (storage, auth, utilities).
- `js/home.js`, `js/auth.js`, `js/dashboard.js`, `js/admin.js` — Page-specific logic.

## How to open it

Just open `index.html` in a browser — no build step, no server required. To host it
publicly, upload the whole folder as-is to any static host (GitHub Pages, Netlify,
Vercel, or your CSC's own hosting) or use this on any Windows PC at the counter via
a local file or a small local web server (recommended — see note below).

## Admin login

- **Username:** `admin`
- **Password:** `KWO@2026`

Change these in `js/app.js` (`ADMIN_USER` / `ADMIN_PASS` near the top) before real use.

## How data is stored — please read

This is a **front-end only** website: there is no server or real database. To make
login, registration and the admin panel actually work without a backend, data is
saved directly in the browser:

- Customer accounts and all request records → browser `localStorage`
- Uploaded PDF/JPG files → browser `IndexedDB`

This means:
- Data is **specific to one browser on one computer**. If a customer registers on
  the counter PC, that account only exists on that PC (not on their phone).
- The admin panel only shows data submitted **from the same browser/computer** it's
  opened on. For a real shop, you'd run this on the counter PC, and both customers
  and admin would use that PC.
- Clearing browser data/cache will erase all accounts and requests, so avoid
  "Clear browsing data" on the counter PC, or take periodic backups (see below).
- Passwords are hashed with a simple in-browser function — fine for a local demo,
  but **not secure enough for real personal data at scale**.

### Backing up data
Since everything lives in the browser, you can back it up any time from the
browser console (F12 → Console tab) by running:
```js
copy(localStorage.getItem('kwo_users'))       // registered customers
copy(localStorage.getItem('kwo_requests'))    // all requests
```
This copies the data to your clipboard as text you can paste into a text file.

## Going further (recommended for real-world use)

For a real shop serving customers from multiple devices (their own phones, home
computers, etc.), you'll eventually want a small backend so data is shared across
devices — for example Firebase, Supabase, or a simple Node.js + database server.
The front-end here is already structured so that swapping `js/app.js`'s
localStorage/IndexedDB calls for real API calls is a contained change — the rest
of the site (pages, forms, admin views) would not need to change.

## Customizing

- **Branding / colours:** edit the CSS variables at the top of `css/style.css`
  (`--navy`, `--saffron`, `--teal`, fonts, etc.).
- **Services list:** edit the `SERVICES` array near the top of `js/home.js`.
- **Contact details / address:** edit the "Reach the counter" section in `index.html`.
- **Admin credentials:** edit `ADMIN_USER` / `ADMIN_PASS` in `js/app.js`.


### Service-specific forms
Each service now opens its own tailored form without changing the Supabase backend schema or the existing theme. Extra fields are stored in the existing `requests.notes` column, and each uploaded document is labelled in the existing `request_files.file_name` column so the admin/customer dashboards continue to work unchanged.


### Important deployment fix
The admin dashboard now loads the same service manifest/config files as the homepage before opening the Service Manager. This makes all existing services (Aadhaar, PAN, Voter ID, certificates, etc.) appear in the editor.
