# Bloom

Bloom is a simple, mobile-first period and cycle tracker with a friendly AI guide. It is a single Next.js app (web + installable PWA) in [`bloom/`](bloom/): the pages, the API routes, the prediction engine, and Bloom AI all live in that one project.

## Demo account

There is one seeded account for testing:

- Email: `demo@bloom.app`
- Password: `Password123!`

The seed only ever creates or resets this one account. Every account created through **Sign up** starts empty and shows a welcome screen until the user logs her first period.

## Features

- Email/password accounts and guest mode
- One-tap period logging and a calendar showing logged periods, expected periods, and fertile days
- Daily check-in with mood stickers, cramps, energy, sleep, and notes (one entry per day)
- Predictions for the next period, fertile window, and ovulation, weighted toward recent cycles, with a confidence level and a late-period state
- Charts: cycle ring, cycle-length history, and how you feel in each phase
- Bloom AI chat that knows the user's cycle and can also just talk
- Light and dark themes, installable PWA with an offline page

## Setup

```bash
cd bloom
cp .env.example .env      # then fill in the values
pnpm install
pnpm db:push              # create the tables (first time only)
pnpm db:seed              # create or reset the demo account
pnpm dev
```

Open `http://localhost:3000`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signs API tokens |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | NextAuth session settings |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google sign-in |
| `ANTHROPIC_API_KEY` | Optional. Turns on Claude-powered Bloom AI |
| `BLOOM_AI_MODEL` | Optional. Claude model override (default `claude-opus-5-5`) |

## Bloom AI

With `ANTHROPIC_API_KEY` set, chat messages are answered by Claude. Each request includes a summary of the user's cycle (cycle day, phase, next period, fertile window, recent check-ins) and the recent conversation, so answers are personal and follow-up questions work. Without a key, or if the AI service is unreachable, Bloom answers from a built-in reply engine, so chat always works.

- Claude integration and prompt: `bloom/lib/bloomAI.ts`
- Built-in replies: `bloom/lib/chatLogic.ts`
- Prediction engine: `bloom/lib/predictor.ts`

## Project layout

```
bloom/
  app/            pages and API routes (app/api/*)
  components/     UI, charts, chat, PWA pieces
  lib/            predictions, AI, auth, date helpers
  prisma/         schema and demo seed
  public/         manifest, service worker, icons
```

## A note on predictions

Predictions are estimates from logged dates. Bloom shows a chance of pregnancy for each day, but counting days is not reliable birth control and the app says so. It is not a medical device.
