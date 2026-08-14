# Backend Setup — Supabase (Knowledge World Online)

Aapka **HTML, CSS, design — kuch bhi nahi badla**. Sirf `js/app.js`,
`js/auth.js`, `js/home.js`, `js/dashboard.js`, `js/admin.js` update kiye
gaye hain taaki woh `localStorage`/`IndexedDB` ki jagah aapke Supabase
project se real data padhein/likhein. Ab data **saare devices/browsers
me shared** rahega, sirf ek computer tak limited nahi.

Project already connected to:
- URL: `https://gzxemrjflbxrexenkofh.supabase.co`
- Publishable (anon) key: already `js/app.js` me daal diya gaya hai

## Step 1 — Database banaye (sirf ek baar)

1. https://supabase.com/dashboard par apna project kholein.
2. Left sidebar me **SQL Editor** → **New query**.
3. Is folder ke `supabase/schema.sql` file ka **pura content copy** karein
   aur query editor me paste karke **Run** dabayein.
4. Yeh script khud:
   - `customers`, `admin_users`, `requests`, `request_files` tables banata hai
   - Password hashing (pgcrypto) setup karta hai
   - Token auto-generate karne wala trigger (`KWO-2026-0001` jaisa) banata hai
   - Security (Row Level Security) policies laga deta hai
   - Ek `kwo-files` Storage bucket bana deta hai (uploaded files ke liye)
   - Default admin account bana deta hai — **Username: `admin` / Password: `KWO@2026`**

Bas itna hi — dobara kabhi run karne ki zaroorat nahi (script safe hai,
dobara run karne se kuch duplicate nahi hoga).

## Step 2 — Website open karein

`index.html` ko seedha browser me kholein ya kisi bhi static host
(Netlify, Vercel, GitHub Pages) par poora folder upload kar dein — jaisa
pehle karte the, waisa hi. Koi build step nahi chahiye.

Register, login, print/xerox request, service request, admin panel —
sab kuch ab live Supabase database use karega.

## Admin login

- URL: `admin-login.html`
- Username: `admin`
- Password: `KWO@2026`

Password badalne ke liye SQL editor me yeh chalayein:
```sql
update public.admin_users
set password_hash = crypt('NayaPassword123', gen_salt('bf'))
where username = 'admin';
```

## ⚠️ Zaroori security note

Yeh setup ek **chhoti si counter/CSC shop ke liye trusted-use design**
hai (jaisa original localStorage version bhi tha):

- Print/Xerox aur Service **requests** table anon (publishable) key se
  sabko readable/writable hai — taaki bina login ke bhi guest apna
  request submit kar sake, aur admin panel bhi kaam kare.
- **Customer passwords** kabhi client tak nahi jaate — sirf server-side
  Postgres functions (RPC) ke through hi check hote hain (`pgcrypto`
  se hashed).
- Admin login bhi ab **real server-side check** hai (pehle wale version
  me admin password seedha JS file me likha hota tha, jo koi bhi dekh
  sakta tha — ab woh problem nahi hai).
- Customer **naam/mobile/email** ki list `list_customers()` RPC se
  milti hai — yeh bhi publishable key se callable hai, isliye technically
  koi bhi jo aapki website ka JS dekh le woh yeh list fetch kar sakta hai
  (jaise admin panel karta hai). Agar aap chahte hain ki sirf real
  logged-in admin hi yeh dekh sake, to Supabase Auth (email/password
  login) add karke RLS ko `auth.uid()` based banana hoga — yeh ek aage
  ka upgrade hai, abhi ke liye functionality wahi hai jo aapne maanga
  (bina frontend badle, poora backend).

Koi bhi sawal ho to bas pooch lena.
