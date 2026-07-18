◇ injected env (16) from ..\..\.env // tip: ⌘ override existing { override: true }
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "collections" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "bitIndex" INTEGER NOT NULL,
    "startBlock" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_holders" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "tokenBalance" INTEGER NOT NULL,
    "lastUpdatedBlock" BIGINT NOT NULL,

    CONSTRAINT "collection_holders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_sync_state" (
    "collectionId" INTEGER NOT NULL,
    "lastSyncedBlock" BIGINT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_sync_state_pkey" PRIMARY KEY ("collectionId")
);

-- CreateTable
CREATE TABLE "polls_metadata" (
    "pollId" BIGINT,
    "id" SERIAL NOT NULL,
    "metadataHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "collectionMask" INTEGER NOT NULL,
    "txHash" TEXT,

    CONSTRAINT "polls_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexed_votes" (
    "id" SERIAL NOT NULL,
    "pollId" BIGINT NOT NULL,
    "voterAddress" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "collectionMask" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexed_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_sync_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedBlock" BIGINT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vote_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_nonces" (
    "nonce" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "pollId" BIGINT NOT NULL,
    "collectionMask" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "eligibility_nonces_pkey" PRIMARY KEY ("nonce")
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

-- AddForeignKey
ALTER TABLE "collection_holders" ADD CONSTRAINT "collection_holders_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_sync_state" ADD CONSTRAINT "collection_sync_state_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

