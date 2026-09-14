# BeatTag

**Beat it. Tag them. Keep it going.**

BeatTag is a mobile-first social challenge platform hosted on GitHub Pages with Supabase providing authentication, profiles, social data, media storage, moderation and Shop/BeatCoins services.

## Production files
- `index.html`, `styles.css`, `app.js` — main app
- `sw.js`, `manifest.webmanifest`, icons — PWA
- `about.html`, `contact.html`, `community-guidelines.html`, `privacy.html`, `terms.html` — legal/info pages
- `robots.txt`, `sitemap.xml`, `404.html` — discovery/error handling
- `supabase_production_hardening_v4.sql` — matching backend hardening migration

## Required deployment step
After uploading this build, run `supabase_production_hardening_v4.sql` once in the Supabase SQL Editor. It secures challenge rewards, makes attempt counting atomic, and cleans expired equipped Shop cosmetics.

## Media limits
Photo: 10 MB (JPEG/PNG/WebP). Video: 50 MB (MP4/WebM). Audio: 20 MB (MP3/WAV/WebM).

## Push notifications
The service worker contains Push API handlers, but fully closed-app push still requires a push subscription flow plus a secure sender/Edge Function and VAPID keys. Never place VAPID private keys or Supabase service-role keys in frontend files.
