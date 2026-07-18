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
