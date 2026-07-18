import type { Address } from "viem";
import { HOLDER_VOICES_ABI } from "@holder-voices/shared";

export { HOLDER_VOICES_ABI };

export function holderVoicesAddress(): Address {
  const address = process.env.NEXT_PUBLIC_HOLDER_VOICES_ADDRESS;
  if (!address) {
    throw new Error(
      "NEXT_PUBLIC_HOLDER_VOICES_ADDRESS is not set — deploy the contract and update web/.env.local"
    );
  }
  return address as Address;
}
