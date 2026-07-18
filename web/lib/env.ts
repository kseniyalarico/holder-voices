function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name} (see web/.env.local)`);
  return value;
}

export const env = {
  eligibilitySignerPrivateKey: () => required("ELIGIBILITY_SIGNER_PRIVATE_KEY") as `0x${string}`,
  holderVoicesAddress: () => required("HOLDER_VOICES_ADDRESS") as `0x${string}`,
  rpcUrl: () => process.env.MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  chainId: () => Number(process.env.MONAD_TESTNET_CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143),
};
