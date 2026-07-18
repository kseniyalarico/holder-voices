import { keccak256, stringToHex } from "viem";

export interface PollMetadataInput {
  title: string;
  question: string;
  description: string;
  endsAt: string; // ISO 8601 — must be byte-identical between hash computations
  collectionMask: number;
}

/**
 * The on-chain `metadataHash` linking a HolderVoices poll to its off-chain
 * title/question/description. Computed identically by the frontend (before
 * calling `createPoll`) and the backend (before storing the pending
 * PollMetadata row) — same shared function, so they always match byte-for-byte.
 */
export function computeMetadataHash(input: PollMetadataInput): `0x${string}` {
  const canonical = JSON.stringify({
    title: input.title,
    question: input.question,
    description: input.description,
    endsAt: input.endsAt,
    collectionMask: input.collectionMask,
  });
  return keccak256(stringToHex(canonical));
}
