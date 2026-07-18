-- CreateTable
CREATE TABLE "collections" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "bitIndex" INTEGER NOT NULL,
    "startBlock" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT
);

-- CreateTable
CREATE TABLE "collection_holders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "collectionId" INTEGER NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "tokenBalance" INTEGER NOT NULL,
    "lastUpdatedBlock" BIGINT NOT NULL,
    CONSTRAINT "collection_holders_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "collection_sync_state" (
    "collectionId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lastSyncedBlock" BIGINT NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL,
    CONSTRAINT "collection_sync_state_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "polls_metadata" (
    "pollId" BIGINT,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "metadataHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME NOT NULL,
    "collectionMask" INTEGER NOT NULL,
    "txHash" TEXT
);

-- CreateTable
CREATE TABLE "indexed_votes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pollId" BIGINT NOT NULL,
    "voterAddress" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "collectionMask" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "votedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "vote_sync_state" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "lastSyncedBlock" BIGINT NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "eligibility_nonces" (
    "nonce" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "pollId" BIGINT NOT NULL,
    "collectionMask" INTEGER NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "collections_contractAddress_key" ON "collections"("contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "collections_bitIndex_key" ON "collections"("bitIndex");

-- CreateIndex
CREATE INDEX "collection_holders_walletAddress_idx" ON "collection_holders"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "collection_holders_collectionId_walletAddress_key" ON "collection_holders"("collectionId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "polls_metadata_pollId_key" ON "polls_metadata"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "polls_metadata_metadataHash_key" ON "polls_metadata"("metadataHash");

-- CreateIndex
CREATE INDEX "indexed_votes_pollId_idx" ON "indexed_votes"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "indexed_votes_pollId_voterAddress_key" ON "indexed_votes"("pollId", "voterAddress");

-- CreateIndex
CREATE UNIQUE INDEX "indexed_votes_txHash_logIndex_key" ON "indexed_votes"("txHash", "logIndex");

-- CreateIndex
CREATE INDEX "eligibility_nonces_walletAddress_pollId_idx" ON "eligibility_nonces"("walletAddress", "pollId");
