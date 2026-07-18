# Holder Voices

**One proposal. Many communities.**

Holder Voices is a platform for public, onchain voting among NFT collection holders on
Monad. One poll can target several NFT communities at once: a wallet connects, the
platform automatically determines which supported collections it holds, and — if
eligible — it casts a single Yes / No / Abstain vote that is recorded onchain and
counted in the results of every community it belongs to.

> Ownership is verified by a local Holder Voices indexer, not onchain — every vote
> itself is publicly recorded on the Monad Testnet `HolderVoices` contract.

This repository is currently a **local-only, Monad Testnet MVP**. It does not touch
Monad Mainnet, is not deployed publicly, and depends on no production infrastructure.

## Contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Requirements](#requirements)
- [Local setup](#local-setup)
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
                  │   SQLite     │◀───────│   vote-indexer    │
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
- **NFT indexer** (`workers/nft-indexer`) — polls `Transfer` events for the three test
  collections, maintains holder balances in SQLite.
- **Vote indexer** (`workers/vote-indexer`) — polls `PollCreated`/`VoteCast` events,
  links poll metadata to onchain poll IDs, records per-collection vote statistics.
- **Database** (`packages/database`) — Prisma + SQLite, the local source of truth for
  everything that doesn't need to be onchain (poll text, indexed holders/votes).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 | Single dev server serves both UI and API routes |
| Wallet | wagmi v3 + viem, injected connector (+ optional WalletConnect) | No embedded/social login needed — spec explicitly excludes email accounts |
| Backend | Next.js Route Handlers | Avoids running a second server for local MVP |
| Database | Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`) | Swaps to Postgres later via `prisma.config.ts` + a different adapter |
| Contracts | Solidity 0.8.28, Foundry, OpenZeppelin 5.6 | `EIP712`/`ECDSA`/`Ownable` — audited primitives, no hand-rolled crypto |
| Indexers | Custom TypeScript pollers (viem `getLogs`) | Matches the project's specific ownership/vote-linking requirements |

## Repository structure

```
holder-voices/
  contracts/                 Foundry project (HolderVoices.sol, TestCollection.sol, tests, deploy scripts)
  web/                        Next.js app — pages + API routes
  packages/
    database/                 Prisma schema, generated client, SQLite adapter
    shared/                   Shared TS: ABI, EIP-712 types, bitmask helpers, Choice enum
  workers/
    nft-indexer/               Polls Transfer events -> collection_holders
    vote-indexer/              Polls PollCreated/VoteCast -> polls_metadata / indexed_votes
  scripts/                     mint-test-nfts.ts, seed-collections.ts, with-root-env.js
  deployments/testnet/         Deployed addresses (written by deploy scripts)
  config/testnet/              Network config (chain id, RPC, explorers)
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
- `DATABASE_URL` — must be an **absolute** path to `packages/database/dev.db` (Next.js
  bundling breaks relative-path resolution here).

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
- **A full SQLite wipe loses poll copy text** — titles/questions/descriptions are
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
4. Swap `DATABASE_URL` to a production Postgres instance (Prisma's `datasource`
   provider is the only line that changes).
5. Deploy `web/` + both indexer workers to real hosting.

None of this is done yet — this repository stays Testnet-only until that migration is
explicitly requested.
