import { createPublicClient, http } from "viem";
import networkConfig from "../../../config/testnet/network.json";

export const CONFIRMATIONS = BigInt(networkConfig.confirmations ?? 5);

// The public testnet-rpc.monad.xyz endpoint hard-caps eth_getLogs at a
// 100-block range ("eth_getLogs is limited to a 100 range") — chunk to match.
export const CHUNK_SIZE = 100n;

export function getPublicClient() {
  return createPublicClient({
    transport: http(process.env.MONAD_TESTNET_RPC_URL ?? networkConfig.rpcUrl),
  });
}

// The public RPC caps requests at 25/sec; a catch-up pass can need hundreds
// of 100-block chunks, so throttle between them to stay well under that.
const CHUNK_DELAY_MS = 120;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function throttleChunk(): Promise<void> {
  await sleep(CHUNK_DELAY_MS);
}
