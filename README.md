# Holder Voices

**One proposal. Many communities.**

Holder Voices is a platform for public, onchain voting among NFT collection holders on
Monad. One poll can target several NFT communities at once: a wallet connects, the
platform automatically determines which supported collections it holds, and — if
eligible — it casts a single Yes / No / Abstain vote that is recorded onchain and
counted in the results of every community it belongs to.

> Ownership is verified by a local Holder Voices indexer, not onchain — every vote
> itself is publicly recorded on the Monad Testnet `HolderVoices` contract.

This repository targets **Monad Testnet only** — it does not touch Monad Mainnet. It
runs either fully locally or hosted (Vercel + a managed Postgres + a free scheduler for
the indexers), so it can keep running without your own machine being on.

## Contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Requirements](#requirements)
- [Local setup](#local-setup)
- [Hosted deployment](#hosted-deployment)
- [Running tests](#running-tests)
- [Known limitations](#known-limitations)
- [Future: migrating to Mainnet](#future-migrating-to-mainnet)

See also [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deeper walkthrough of the
data flow from wallet connect to a vote appearing in the results.

## Architecture

```
                  ┌──────────────┐        ┌───────────────────┐
   wallet ───────▶│  web (Next)  │───────▶│  HolderVoices.sol │  Monad Testnet
                  │  frontend +  │        │  (votes, polls)   │
                  │  API routes  │        └─────────┬─────────┘
                  └──────┬───────┘                  │ PollCreated
                         │ EIP-712                   │ VoteCast
                         │ signed proof              ▼
                  ┌──────┴───────┐        ┌───────────────────┐
                  │   Postgres   │◀───────│   vote-indexer    │
                  │  (Prisma)    │        └───────────────────┘
                  └──────┬───────┘
                         ▲ Transfer events
                  ┌──────┴───────┐        ┌───────────────────┐
                  │  nft-indexer │◀───────│ TestCollection A/B/C │
                  └──────────────┘        └───────────────────┘
```

- **Frontend** (`web/`) — Next.js App Router UI: connect wallet, browse/create polls,
  vote, view results and vote history.
- **Backend** (`web/app/api/*`) — Next.js Route Handlers: collection registry,
  read-only eligibility checks, EIP-712 eligibility proof signing, poll metadata.
- **Smart contracts** (`contracts/`) — `HolderVoices.sol` (polls + votes) and three
  plain ERC-721 `TestCollection` contracts (A/B/C) for local development.
- **NFT indexer** (`workers/nft-indexer`, `web/app/api/cron/nft-indexer`) — polls
  `Transfer` events for the three test collections, maintains holder balances.
- **Vote indexer** (`workers/vote-indexer`, `web/app/api/cron/vote-indexer`) — polls
  `PollCreated`/`VoteCast` events, links poll metadata to onchain poll IDs, records
  per-collection vote statistics.
- **Indexer core** (`packages/indexer-core`) — the actual sync logic (one pass per
  call), shared between the long-running CLI workers (local dev) and the cron-triggered
  API routes (hosted deployment) — same code, two ways of scheduling it.
- **Database** (`packages/database`) — Prisma + Postgres, the source of truth for
  everything that doesn't need to be onchain (poll text, indexed holders/votes).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 | Single dev server serves both UI and API routes |
| Wallet | wagmi v3 + viem, injected connector (+ optional WalletConnect) | No embedded/social login needed — spec explicitly excludes email accounts |
| Backend | Next.js Route Handlers | Avoids running a second server for local MVP |
| Database | Prisma 7 + Postgres (Neon, provisioned via Vercel) | Same engine locally and hosted — no SQLite/Postgres dialect drift |
| Contracts | Solidity 0.8.28, Foundry, OpenZeppelin 5.6 | `EIP712`/`ECDSA`/`Ownable` — audited primitives, no hand-rolled crypto |
| Indexers | Custom TypeScript pollers (viem `getLogs`), shared core reused by a CLI loop and Vercel cron routes | Matches the project's specific ownership/vote-linking requirements; one pass per invocation works both ways |
| Indexer scheduling (hosted) | GitHub Actions (every 5 min) → `/api/cron/*` | Vercel Hobby cron is capped at once/day — a scheduled workflow in this already-public repo is free and hits the same routes |

## Repository structure

```
holder-voices/
  contracts/                 Foundry project (HolderVoices.sol, TestCollection.sol, tests, deploy scripts)
  web/                        Next.js app — pages + API routes + web/app/api/cron/* + vercel.json
  packages/
    database/                 Prisma schema (Postgres), generated client
    shared/                   Shared TS: ABI, EIP-712 types, bitmask helpers, Choice enum
    indexer-core/              Single-pass sync logic shared by the CLI workers and cron routes
  workers/
    nft-indexer/               CLI loop around indexer-core's NFT sync pass
    vote-indexer/              CLI loop around indexer-core's vote sync pass
  scripts/                     mint-test-nfts.ts, seed-collections.ts, with-root-env.js
  deployments/testnet/         Deployed addresses (written by deploy scripts)
  config/testnet/              Network config (chain id, RPC, explorers)
  .github/workflows/           indexers.yml — calls /api/cron/* every 5 min (hosted deployment)
  docs/ARCHITECTURE.md
  .env.example / .env          Root env (contracts + indexers)
  web/.env.local                Frontend + API env (mirrors the root .env)
```

## Requirements

- Node.js 20.9+ (Next.js 16 minimum) — this repo was built with Node 24
- [Foundry](https://getfoundry.sh) (`forge`, `cast`) — install via `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- A Monad Testnet wallet with test MON — fund it at the [faucet](https://faucet.monad.xyz)

## Local setup

### 1. Install dependencies

```bash
npm install
```

This installs all npm workspaces (`web/`, `packages/*`, `workers/*`). `contracts/lib/`
(forge-std + OpenZeppelin) is gitignored — installed via `forge install`, not committed
as submodules — so fetch it separately:

```bash
cd contracts
forge install --no-git foundry-rs/forge-std
forge install --no-git OpenZeppelin/openzeppelin-contracts
cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` (repo root — read by `contracts/` and `workers/`):

- Network values are already correct (verified against `docs.monad.xyz`).
- `ELIGIBILITY_SIGNER_PRIVATE_KEY` / `ELIGIBILITY_SIGNER_ADDRESS` — a **local test
  keypair** used only to sign offchain eligibility proofs (no funds, never sends a
  transaction). Generate one with `cast wallet new`.
- `DEPLOYER_PRIVATE_KEY` — either your own funded Testnet key, **or** leave blank to
  deploy via the monskills agent wallet + Safe multisig flow (every transaction then
  requires your approval in the Safe UI).
- `DATABASE_URL` — a Postgres connection string. Easiest: create a free
  [Neon](https://neon.tech) project yourself, or provision one from Vercel's Storage
  tab (see [Hosted deployment](#hosted-deployment)) and use the same connection string
  for local dev too — one database, no local/hosted drift.
- `CRON_SECRET` — random string used to authenticate calls to `/api/cron/*` (only
  needed once you're running the hosted indexers; generate with
  `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`).

Then create `web/.env.local` the same way, mirroring the relevant values (network
config, `ELIGIBILITY_SIGNER_*`, `DATABASE_URL`, and the `NEXT_PUBLIC_*` variants) — see
the committed `web/.env.local` for the exact shape (gitignored, so copy from a
teammate or reconstruct from `.env.example`).

### 3. Set up the database

```bash
npm run db:migrate
```

### 4. Deploy the three test NFT collections

```bash
npm run deploy:test-collections
npm run seed:collections
```

The first command deploys `TestCollection` three times (Collection A/B/C) and writes
`deployments/testnet/collections.json`. The second upserts those addresses into the
`Collection` table (bit 0/1/2).

### 5. Deploy the HolderVoices voting contract

```bash
npm run deploy:testnet
```

Writes `deployments/testnet/holder-voices.json`. Copy the printed address into
`HOLDER_VOICES_ADDRESS` (root `.env`) and `HOLDER_VOICES_ADDRESS` /
`NEXT_PUBLIC_HOLDER_VOICES_ADDRESS` (`web/.env.local`).

### 6. Verify the contracts (optional but recommended)

Use the monskills verification API (verifies on MonadVision, Monadscan, and Socialscan
in one call) rather than `forge verify-contract` directly — see the `scaffold` monskill
for the exact request shape.

### 7. Mint test NFTs

Copy `scripts/test-wallets.example.json` to `scripts/test-wallets.json`, fill in three
real Testnet addresses (see the example file for the intended Wallet 1 / 2 / 3 split),
then:

```bash
npm run mint:test
```

### 8. Run the indexers (each in its own terminal, long-running)

```bash
npm run indexer:nft
npm run indexer:votes
```

Add `-- --full` to either command for a one-shot full resync (wipes and replays from
the contract's deploy/start block).

### 9. Run the app

```bash
npm run dev
```

Open http://localhost:3000, connect a wallet on Monad Testnet, and create/vote on a
poll.

## Hosted deployment

Runs Holder Voices without your own machine: Vercel hosts the frontend + API, Neon
(via Vercel's Storage tab) hosts Postgres, and a GitHub Actions workflow keeps the two
indexers ticking every 5 minutes by calling `/api/cron/nft-indexer` and
`/api/cron/vote-indexer`. These are steps only you can do (account creation, dashboard
clicks, OAuth) — this is the checklist:

### 1. Create the Vercel project

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import
   `kseniyalarico/holder-voices` from GitHub.
2. **Root Directory**: set to `web`. Vercel auto-detects the npm workspace root and
   installs from there; the build command comes from `web/vercel.json` (runs
   `prisma migrate deploy` before `next build`, so schema changes apply automatically
   on every deploy).

### 2. Add Postgres (Neon via Vercel)

Project → **Storage** tab → **Create Database** → **Postgres** (Neon). Vercel injects
`DATABASE_URL` into the project automatically — no separate Neon signup needed.

### 3. Set environment variables

Project → **Settings → Environment Variables** (Production + Preview):

| Variable | Value |
|---|---|
| `ELIGIBILITY_SIGNER_PRIVATE_KEY` | your local test signer key (see `.env`) |
| `ELIGIBILITY_SIGNER_ADDRESS` | matching public address |
| `HOLDER_VOICES_ADDRESS` | deployed contract address |
| `HOLDER_VOICES_DEPLOY_BLOCK` | deployed contract's block number |
| `MONAD_TESTNET_RPC_URL` | `https://testnet-rpc.monad.xyz` |
| `MONAD_TESTNET_CHAIN_ID` | `10143` |
| `NEXT_PUBLIC_CHAIN_ID` | `10143` |
| `NEXT_PUBLIC_RPC_URL` | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_MONADVISION_URL` | `https://testnet.monadvision.com` |
| `NEXT_PUBLIC_MONADSCAN_URL` | `https://testnet.monadscan.com` |
| `NEXT_PUBLIC_HOLDER_VOICES_ADDRESS` | deployed contract address |
| `CRON_SECRET` | same random string you'll put in the GitHub secret below |

`DATABASE_URL` is already set by step 2 — leave it as-is.

### 4. Deploy

Trigger a deploy (push to `master`, or click **Deploy** in the Vercel dashboard). Note
the resulting URL (e.g. `https://holder-voices.vercel.app`).

### 5. Wire up the indexer schedule

In the GitHub repo → **Settings → Secrets and variables → Actions**:

- **Secrets** tab → add `CRON_SECRET` (same value as on Vercel).
- **Variables** tab → add `APP_URL` = your Vercel deployment URL (no trailing slash).

`.github/workflows/indexers.yml` is already committed and will start firing on its own
schedule (every 5 minutes) once these are set — or trigger it manually from the
**Actions** tab (**Run workflow**) to confirm it works right away.

### Why not just use Vercel Cron?

Vercel's free Hobby plan only allows cron jobs **once per day** — nowhere near enough
for near-real-time indexing. GitHub Actions scheduled workflows are free for this
already-public repo and can run every 5 minutes, hitting the exact same `/api/cron/*`
routes a native Vercel Cron job would. If you upgrade to Vercel Pro later, you can
switch to a `vercel.json` `crons` block instead and drop the GitHub Actions workflow.

## Running tests

```bash
npm test              # Foundry contract tests + any workspace test scripts
npm run test:contracts  # Foundry tests only (21 tests: TestCollection + HolderVoices)
```

The Foundry suite covers: valid/invalid poll creation, single- and multi-collection
votes, double-vote rejection, forged/mismatched/expired/tampered signatures, voting
after a poll ends, and correct counter/event data. See `contracts/test/`.

## Known limitations

- **MVP scope only** — no anonymity, delegation, vote changes, NFT-weighted voting,
  quadratic voting, rewards, DAO treasury, or automatic execution of poll outcomes.
- **Reorg handling is basic** — indexers trail the chain tip by a fixed confirmation
  buffer rather than detecting deep reorgs; acceptable for local Testnet MVP use.
- **A full database wipe loses poll copy text** — titles/questions/descriptions are
  intentionally offchain to keep `vote()` cheap; only `metadataHash` survives onchain,
  so a poll's *text* can't be reconstructed after a DB wipe (vote tallies and
  collection-holder balances can — see `-- --full` above).
- **Not decentralized** — NFT ownership is verified by Holder Voices' own indexer, not
  onchain; only the votes themselves are onchain and public.

## Future: migrating to Mainnet

The architecture doesn't need code changes to move to Mainnet later — only config:

1. Add `config/mainnet/network.json` and `deployments/mainnet/` (mirroring the
   `testnet` versions).
2. Deploy `HolderVoices` + real collection registrations to Mainnet (no `TestCollection`
   contracts — Mainnet uses real, already-deployed NFT collections).
3. Point the NFT indexer at the real collections' addresses and correct start blocks.
4. Point `DATABASE_URL` at a separate (production) Postgres database/branch — already
   Postgres end-to-end, so this is just a different connection string, not a migration.

None of this is done yet — this repository stays Testnet-only until that migration is
explicitly requested.
