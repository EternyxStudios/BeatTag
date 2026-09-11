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
