# Card Perks

A small web app for keeping track of credit card credits, deadlines, and whether each card earns back its annual fee. It runs entirely in the browser: there's no build step, and GitHub Pages hosts it for free.

Live at **https://awaythrow2222.github.io/card-perks/**

## Screens

- **Home**: every unused credit, sorted by deadline (due within 7 days, this month, later, anytime). Each one has buttons to log a dollar amount, mark it fully used, or skip it for this period.
- **Cards**: add cards from the built-in catalog, and their credits, earning rates and perks fill in automatically. A card's page shows:
  - each credit's status for the current period, plus a month/quarter history strip you can click to fill in past periods
  - an "extra perk value" log for one-off perks (lounge visits, free checked bags, hotel property credits)
  - earning rates, other benefits, and card settings (anniversary, the fee you actually pay, custom rates and credits)
- **Best card**: for each spending category, your cards ranked by estimated return (points × cents per point). Rotating 5% categories, spending caps, Costco's Visa-only rule and foreign transaction fees are all taken into account.
- **Summary**: total annual fees vs. the value you've used this year, net per card, and how much credit value is still available before December 31.
- **Settings**: Google sign-in for sync, cents-per-point values, each quarter's rotating categories, and JSON backup/restore.

### How tracking works

- **Dollar credits** (Uber Cash, dining credits, and so on) take partial amounts and check themselves off once they reach the full value.
- **Checkbox perks** (Companion Fare, anniversary miles, Apple TV) carry an estimated dollar value that you can edit. Reminders such as "activate 5% categories" are worth $0.
- **Periods** reset monthly, quarterly, Jan–Jun/Jul–Dec, each calendar year, on your card anniversary, or every few years (Global Entry).
- **Value used** counts only credits and perks. It leaves out points and cash back earned from everyday spending.

## Card data

The catalog lives in [`js/data.js`](js/data.js) and was researched in October 2026. It covers Sapphire Reserve/Preferred, Freedom (legacy), Freedom Flex, Freedom Unlimited, Ink Business Cash, Amex Gold/Platinum, Venture X, Discover it, Costco Anywhere Visa, AAdvantage MileUp, Atmos Rewards Ascent, Amazon Prime Visa, Double Cash, and a custom card option. Issuers change benefits often, so you can edit any amount on the card page. When a new quarter's 5% categories come out, add them in Settings or in `ROTATING` in `data.js`.

## Sync (Firebase)

This app uses the same Firebase project as Lingua (`lingua-9610a`). Each account's data is stored in `users/{uid}/apps/cardperks`. Lingua's security rule only covers `users/{uid}`, so **add the subcollection rule** under Firebase console → Firestore Database → Rules, then publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /users/{uid}/{rest=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

`awaythrow2222.github.io` is already an authorized sign-in domain for Lingua, so nothing else needs to change. Without signing in, data stays in the browser's local storage.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Tests: `node --test tests/logic.test.mjs`.

## Project layout

| File | What it does |
|---|---|
| `js/data.js` | Card catalog, spending categories, point values, rotating categories |
| `js/logic.js` | Periods and deadlines, value used, best-card rankings (pure functions, tested) |
| `js/store.js` | localStorage state and the merge logic for sync |
| `js/sync.js` | Google sign-in and Firestore sync |
| `js/app.js` | Views and dialogs |
| `sw.js` | Offline cache. Bump `CACHE` when files change. |
