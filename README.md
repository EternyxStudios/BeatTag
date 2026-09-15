# BeatTag V2 Complete

Mobile-first, zero-cost static BeatTag prototype for GitHub Pages.

## What works
- Home / Explore / Create / Chains / Profile / Coin Shop navigation
- Create text/photo/video/audio challenges
- Camera access for photo/video (HTTPS required; GitHub Pages supports this)
- Microphone audio recording
- File picker fallback
- Beat an existing challenge (creates next generation)
- Like or dislike: one reaction per local profile per challenge; toggling is supported
- Comments
- Tag friend + Web Share / copied link
- Chain/generation view
- Profile stats and editing
- Coins and cosmetic Coin Shop with temporary/permanent unlocks
- Local persistence via localStorage
- PWA shell/service worker

## Important limitation
This V2 is fully working on one browser/device, but it is still a static GitHub Pages app. Real public accounts, globally synced likes/comments, cross-device challenge chains, notifications, and public media storage require a backend/database (for example a free-tier backend). GitHub Pages alone cannot provide shared multi-user data.

## GitHub Pages
Upload all files to the repository root, then Settings → Pages → Deploy from branch → main → /(root).


## V12 six-file deployment
This build keeps deployment limited to app.js, index.html, styles.css, sw.js, manifest.webmanifest and README.md. It fixes Forgot Password modal visibility on the auth screen and moves Logout/Delete Account from Profile into Settings. Settings includes Account, Notifications, Privacy & Safety, App Preferences, Help & Support, Logout and Danger Zone. Existing Supabase V4/V5 migrations are reused; do not rerun them for this client update.


## V13 final polish
- Profile Settings uses a compact top-right neon gear button.
- Edit Profile and Share Profile are side-by-side.
- Header information menu removed; About, Contact, Community Guidelines, Privacy Policy and Terms remain in Settings > Help & Support.
- Challenge cards use creator profile photos when available and collapse long descriptions with Read more / Show less.
- Parent challenge references are clickable and deep chains can collapse/expand.
- Challenge Pass shows next milestone/reward.
- Logout closes overlays before showing Login.
- Delete Account and Delete Challenge use BeatTag-styled confirmation UI.
- Existing V4/V5 Supabase migrations are reused; do not rerun them.
