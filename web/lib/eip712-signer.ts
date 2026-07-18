import { privateKeyToAccount } from "viem/accounts";
import { eligibilityDomain, ELIGIBILITY_PROOF_TYPES, type EligibilityProof } from "@holder-voices/shared";
import { env } from "./env";

/** Signs an EligibilityProof with the backend's eligibility signer key — never exposed to the browser. */
export async function signEligibilityProof(proof: EligibilityProof): Promise<`0x${string}`> {
  const account = privateKeyToAccount(env.eligibilitySignerPrivateKey());
  const domain = eligibilityDomain(env.chainId(), env.holderVoicesAddress());
  return account.signTypedData({
    domain,
    types: ELIGIBILITY_PROOF_TYPES,
    primaryType: "EligibilityProof",
    message: proof,
  });
}

/** Cryptographically random uint256, used as the EligibilityProof nonce. */
export function generateNonce(): bigint {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  let hex = "0x";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return BigInt(hex);
}
