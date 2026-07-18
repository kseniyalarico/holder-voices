# Holder Voices — Architecture

This document walks through each component and the full data flow from a wallet
connecting to a vote appearing in the results. See the root [README.md](../README.md)
for setup instructions.

## Components

### Frontend (`web/app`, `web/components`)

Next.js 16 App Router. Server Components (`app/page.tsx`, `app/polls/[pollId]/page.tsx`)
query the database directly (`@holder-voices/database`) for the initial render — no
self-fetch over HTTP. Client Components (`ConnectButton`, `PollView`, `VoteHistory`,
the create-poll form) handle wallet state and refetch per-wallet data (eligibility,
`hasVoted`) once a wallet connects, via the same JSON API the routes expose.

Wallet connectivity is wagmi v3 (`useConnection`, `useConnect`, `useSwitchChain`,
`useWriteContractSync`) configured for Monad Testnet only (`web/lib/wagmi.ts`).
`useWriteContractSync` is used for both `createPoll` and `vote` — Monad's
`eth_sendRawTransactionSync` RPC method returns the transaction receipt in the same
round trip, so the UI doesn't need a separate polling step to know a vote landed.

### Backend (`web/app/api/*`, `web/lib/*`)

Next.js Route Handlers, colocated with the frontend (one dev server, per the approved
plan's MVP-simplicity call):

| Route | Purpose |
|---|---|
| `GET /api/collections` | Public collection registry |
| `GET /api/eligibility` | Read-only eligibility check (no signature) — drives UI before a wallet commits to voting |
| `POST /api/eligibility/sign` | Issues the EIP-712 proof a wallet needs to call `vote()` |
| `GET /api/polls`, `POST /api/polls` | List confirmed polls; register a new poll's offchain text and get back the `metadataHash`/`collectionMask` to submit onchain |
| `GET /api/polls/:pollId` | Poll detail: DB metadata + a **live** onchain `getPoll()`/`hasVoted()` read + per-collection breakdown from indexed votes |
| `GET /api/polls/:pollId/votes` | Paginated public vote history |

`web/lib/polls.ts` holds the query logic shared between the API routes and the Server
Component pages, so there's exactly one implementation of "what a poll looks like."

### Smart contracts (`contracts/src`)

- **`TestCollection.sol`** — one reusable OpenZeppelin `ERC721` + `Ownable` contract,
  deployed three times (Collection A/B/C) with owner-gated `mint`/`mintWithId` and a
  public `burn`. No real-project names, no complex NFT features.
- **`HolderVoices.sol`** — polls + votes. Key design choices (see inline NatSpec for
  full rationale):
  - No onchain collection registry — the contract only ever sees an opaque `uint32`
    bitmask. The bit ↔ collection mapping lives in `packages/shared` and the
    `collections` DB table, so adding collection #4–20 never touches the contract.
  - "Active" is derived (`block.timestamp < endsAt`), not stored.
  - `vote()` does one `hasVoted` write, one counter write, one `uniqueVoters` write —
    flat gas regardless of how many collections the platform supports (Monad charges
    gas on the transaction's gas *limit*, not usage, so predictable, low gas matters).
  - Eligibility itself is never checked onchain (no `balanceOf` calls) — it's asserted
    by a backend-signed EIP-712 proof, which the contract independently verifies
    (signer address, expiry, poll ID, wallet, chain ID, contract address all bound
    into the signed struct).

### EIP-712 eligibility (`web/lib/eligibility.ts`, `web/lib/eip712-signer.ts`, `packages/shared/src/eip712.ts`)

The `EligibilityProof` struct and EIP-712 domain (`name: "HolderVoices"`, `version:
"1"`, chain ID 10143, `verifyingContract` = the deployed address) are defined once in
`packages/shared` and used identically by the backend signer and (implicitly, via the
contract's own `_hashTypedDataV4`) onchain verification — there is no separate
frontend-side copy of this logic, so there's no way for the two to drift apart.

Flow:
1. Frontend calls `GET /api/eligibility` for instant, non-binding UI feedback.
2. On vote, frontend calls `POST /api/eligibility/sign`.
3. Backend re-derives eligibility from `CollectionHolder` (restricted to the poll's
   `allowedCollectionMask`), rejects if the mask is `0` or the poll isn't active,
   generates a `nonce` + 5-minute `expiresAt`, records an `EligibilityNonce` row, and
   signs the struct with `ELIGIBILITY_SIGNER_PRIVATE_KEY`.
4. Frontend calls `HolderVoices.vote(...)` directly with the returned proof — the
   contract is the final authority, re-checking everything itself.

### NFT indexer (`workers/nft-indexer`)

Long-running Node process (not a serverless function — Monad's ~400ms block time and
the spec's "update roughly once a minute" requirement both fit a simple loop better
than cold-starting a function every tick). Per active `Collection` row:

1. Read `CollectionSyncState.lastSyncedBlock` (or `startBlock` on first run).
2. Compute a safe tip (`latestBlock - CONFIRMATIONS`, confirmations from
   `config/testnet/network.json`) to avoid acting on blocks that could still reorg —
   Monad's async execution model means shallow reorgs are possible.
3. Fetch `Transfer` logs in chunks (100 blocks/call — the public
   `testnet-rpc.monad.xyz` endpoint hard-caps `eth_getLogs` at that range),
   apply balance deltas
   (`from`/`to` vs. the zero address covers mint/transfer/burn uniformly), advance the
   sync cursor only after each chunk commits.
4. `--full` wipes `CollectionHolder`/`CollectionSyncState` for a from-scratch replay.

### Vote indexer (`workers/vote-indexer`)

Same polling shape, single contract, two event types fetched together
(`getLogs({ events: [PollCreated, VoteCast] })`):

- `PollCreated` → finds the pending `PollMetadata` row by `metadataHash` and sets its
  `pollId`/`txHash` — this is what "links" a poll drafted via `POST /api/polls` to the
  transaction the creator's own wallet actually submitted.
- `VoteCast` → decodes `collectionMask` into individual collection bits, inserts one
  `IndexedVote` row. The `(pollId, voterAddress)` and `(txHash, logIndex)` unique
  constraints make re-processing a log a no-op rather than a double-count, so
  `-- --full` (wipe `indexed_votes`/`vote_sync_state`, replay from the deploy block)
  fully reconstructs both vote tallies and poll linkage from chain logs alone.

### Database (`packages/database`)

Prisma 7 + Postgres (Prisma 7 removed inline `datasource.url` from `schema.prisma` —
the connection string now lives in `prisma.config.ts` for the CLI and is read from
`process.env.DATABASE_URL` at runtime; Postgres needs no driver adapter, unlike
SQLite). One database serves both local dev and the hosted deployment — typically a
Neon Postgres instance provisioned via Vercel's Storage tab. Tables: `collections`,
`collection_holders`, `collection_sync_state`, `polls_metadata`, `indexed_votes`,
`vote_sync_state`, `eligibility_nonces` — see `prisma/schema.prisma` for exact fields
and constraints.

### Indexer core (`packages/indexer-core`)

`runNftSyncPass()` and `runVoteSyncPass()` each do exactly one pass and are shared
between two schedulers:

- **Local dev**: `workers/nft-indexer` and `workers/vote-indexer` are thin CLIs that
  call the pass in an infinite loop with a 60s sleep (`npm run indexer:nft` /
  `indexer:votes`), or once with `-- --full`.
- **Hosted**: `web/app/api/cron/nft-indexer` and `.../vote-indexer` call the same pass
  once per HTTP request, protected by a `CRON_SECRET` bearer token. A GitHub Actions
  workflow (`.github/workflows/indexers.yml`) hits both routes every 5 minutes, since
  Vercel's free Hobby plan only allows native cron jobs once per day.

## Full data flow: wallet connect → vote → stats

1. **Connect** — `ConnectButton` (wagmi `useConnect`) connects an injected wallet;
   `useSwitchChain` prompts a switch if the wallet isn't on Monad Testnet (chain ID
   10143).
2. **Eligibility (read-only)** — `PollView` fetches `GET /api/polls/:id?wallet=...`,
   which calls `computeEligibility()`: joins `CollectionHolder` (balance > 0) against
   the poll's `allowedCollectionMask`-restricted collection set, and reads
   `hasVoted()` live from the contract. The UI status badge (`connect` /
   `wrong-network` / `closed` / `voted` / `ineligible` / `eligible`) is derived from
   this response.
3. **Cast vote** — user picks Yes/No/Abstain and confirms. Frontend calls
   `POST /api/eligibility/sign` (issues the signed `EligibilityProof`), then
   `HolderVoices.vote(...)` via `useWriteContractSync` from the connected wallet.
4. **Onchain** — the contract re-validates everything independently and, if valid,
   flips `hasVoted[pollId][voter]`, bumps the matching choice counter and
   `uniqueVoters`, and emits `VoteCast(pollId, voter, choice, collectionMask,
   ownershipCheckedAt)`.
5. **Indexing** — within ~60s, `vote-indexer` picks up the `VoteCast` log, decodes
   `collectionMask` into individual collections, and inserts one `IndexedVote` row.
6. **Stats** — the poll page's headline Yes/No/Abstain/uniqueVoters numbers are read
   **live** from `getPoll()` (always fresh, no indexer lag); the per-collection
   breakdown and vote history come from `IndexedVote`, so they reflect whatever the
   indexer has processed so far. A disclaimer in the UI explains that one wallet can
   count in multiple collections' breakdowns but only once in the overall total.

## Mainnet migration notes

See the README's [Future: migrating to Mainnet](../README.md#future-migrating-to-mainnet)
section — in short, this is a config-only change (`config/mainnet`,
`deployments/mainnet`, a Postgres `DATABASE_URL`, real collection addresses); no
contract or indexer code changes are required.
