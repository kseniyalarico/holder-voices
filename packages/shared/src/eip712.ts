import type { Address } from "viem";

/**
 * EIP-712 domain and typed-data shape for the eligibility proof signed by the
 * backend and verified on-chain by HolderVoices.vote(). Keep this in sync with
 * the `EligibilityProof` struct in contracts/src/HolderVoices.sol.
 */
export const EIP712_DOMAIN_NAME = "HolderVoices";
export const EIP712_DOMAIN_VERSION = "1";

export function eligibilityDomain(chainId: number, verifyingContract: Address) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  } as const;
}

export const ELIGIBILITY_PROOF_TYPES = {
  EligibilityProof: [
    { name: "pollId", type: "uint256" },
    { name: "voter", type: "address" },
    { name: "collectionMask", type: "uint32" },
    { name: "ownershipCheckedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export interface EligibilityProof {
  pollId: bigint;
  voter: Address;
  collectionMask: number;
  ownershipCheckedAt: bigint;
  expiresAt: bigint;
  nonce: bigint;
}
