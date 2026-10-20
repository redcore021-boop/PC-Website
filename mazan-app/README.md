# Mazan

A private calorie and macro tracker for iPhone, built with Expo SDK 54 (React Native + TypeScript).
All data lives in a local SQLite database on the phone. No account, no backend, no ads.
Hebrew and English with right-to-left layout.

The project stays on **Expo SDK 54** on purpose: it is the newest SDK the App Store build of Expo Go
runs. Newer SDKs need a custom Expo Go via TestFlight (paid Apple Developer account).

## Run it on your iPhone

You need a computer (Mac, Windows or Linux) with [Node.js 20+](https://nodejs.org) and a free
[Expo account](https://expo.dev/signup). On a physical iPhone, Expo Go only opens projects when
Expo Go and the Expo CLI on your computer are signed in to the **same** Expo account.

1. On the iPhone, install **Expo Go** from the App Store and sign in with your Expo account.
2. On the computer:
   ```sh
   git clone https://github.com/redcore021-boop/PC-Website.git
   cd PC-Website/mazan-app
   npm install
   npx expo login -u <your-username>   # same account as in Expo Go
   npx expo start
   ```
3. Keep the phone on the same Wi-Fi as the computer and scan the QR code in the terminal with the
   iPhone Camera app. It opens in Expo Go.
   If the phone cannot reach the computer (for example on office Wi-Fi), use `npx expo start --tunnel`.

To update later: `git pull`, `npm install`, `npx expo start`.

## Checks

```sh
npm run typecheck     # TypeScript
npm run lint          # ESLint (expo lint)
npm run check:bundle  # full iOS production bundle, catches import/resolution errors
```

## Project layout

```
src/
  app/          Expo Router screens: (tabs)/, onboarding, add, food/[id], entry/[id], quick-add, custom-food, profile
  components/   UI kit: Txt (direction-aware text), ui (Screen, Header, Button, Field…), nutrition (Ring, bars, table), Icon, overlays
  db/           migrations (PRAGMA user_version), seed foods, change events, repo/* (settings, foods, diary, body)
  domain/       types, nutrients, BMR/TDEE/goals, portions, dates, formatting — no React, no SQLite
  features/     screen-level pieces shared between routes (onboarding flow, meal cards, portion picker, day summary)
  hooks/        useDbQuery: SQLite query that refreshes when its data changes
  i18n/         en.ts / he.ts (Hebrew must translate every key; TypeScript enforces it)
  state/        AppProvider: language, theme, profile, goals, preferences
  theme/        colour tokens for light and dark
```

### Right-to-left

Expo Go resets the native RTL flag, so Mazan does not use it (`supportsRTL: false`). Each screen sets
`direction: 'rtl' | 'ltr'` on its root view and `Txt`/`Field` set the writing direction, which lets the
language switch instantly without restarting the app.

### Data model

Foods store nutrients per 100 g/ml (or per 1 serving for count-only foods) plus a list of servings.
Diary entries keep a snapshot of the food's name and the nutrient totals, so editing or deleting a food
never rewrites history. Schema changes go in a new entry at the end of `src/db/migrations.ts`.

## Build stages

1. ✅ Data layer, onboarding, diary
2. Food search (Open Food Facts + USDA) and barcode scanner
3. Dashboard, exercise, weight, measurements, photos
4. Premium features: custom/weekday/per-meal goals, full nutrients, analysis, fasting, meal planner, recipes, saved meals, export/backup, reminders
5. Polish
