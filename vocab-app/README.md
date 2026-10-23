# Lexicon — advanced English vocabulary (PWA)

A free, offline-first vocabulary trainer for C1–C2 English: FSRS spaced repetition,
active-recall cards, Hebrew hints, local-only storage. No server, no account, $0 to run.

## Develop

```sh
npm install
npm run dev            # http://localhost:5173
npm test               # unit tests (engine, storage, backup)
npm run validate-words # checks every word batch
```

End-to-end check against a production build:

```sh
npm run build && npx vite preview --port 4173 &
NODE_PATH=$(npm root -g) node scripts/e2e.mjs
```

## Word data

Words live in `src/data/words/*.json` — one file per batch, separate from app logic.
To add a batch, drop in a new file with the same shape and run `npm run validate-words`.
Each example marks the target form in `[brackets]`; precision sentences use `___`
(add `"ans"` when the blank needs an inflected form, e.g. `"juxtaposes"`).

## Deploy (GitHub Pages, free)

This repo already publishes the `docs/` folder of `master` with GitHub Pages, so the app
is served from `docs/vocab/`:

```sh
npm run deploy:docs   # builds and copies dist/ to ../docs/vocab
git add ../docs/vocab && git commit -m "Deploy Lexicon" && git push
```

URL: `https://<user>.github.io/<repo>/vocab/`

Any other static host works too, because all paths are relative:
- **Netlify / Cloudflare Pages:** build command `npm run build`, publish directory `dist`,
  base directory `vocab-app`.

## Install on a phone

- **iPhone:** open the URL in Safari → Share → *Add to Home Screen*.
- **Android:** open in Chrome → ⋮ → *Install app*.

All progress is stored in IndexedDB on the device. Use **Settings → Export backup** regularly.
