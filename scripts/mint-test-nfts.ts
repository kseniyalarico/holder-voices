/**
 * Mints test NFTs to the wallets listed in scripts/test-wallets.json
 * (copy from test-wallets.example.json and fill in real addresses first).
 *
 * Reads deployed collection addresses from deployments/testnet/collections.json
 * (written by `forge script DeployCollections`).
 *
 * Requires DEPLOYER_PRIVATE_KEY in the root .env — the same account that
 * owns the three TestCollection contracts (see contracts/script/DeployCollections.s.sol).
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const TEST_COLLECTION_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

interface CollectionsDeployment {
  collectionA: { address: Address };
  collectionB: { address: Address };
  collectionC: { address: Address };
}

interface TestWalletsConfig {
  wallets: { label: string; address: Address; collections: ("A" | "B" | "C")[] }[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

async function main() {
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env — this must be the TestCollection owner account.");
  }
  const rpcUrl = process.env.MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz";

  const deploymentPath = path.join(ROOT, "deployments/testnet/collections.json");
  const walletsPath = path.join(ROOT, "scripts/test-wallets.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Missing ${deploymentPath} — run \`npm run deploy:test-collections\` first.`);
  }
  if (!fs.existsSync(walletsPath)) {
    throw new Error(`Missing ${walletsPath} — copy scripts/test-wallets.example.json and fill in real addresses.`);
  }

  const deployment = readJson<CollectionsDeployment>(deploymentPath);
  const { wallets } = readJson<TestWalletsConfig>(walletsPath);

  const collectionAddress: Record<"A" | "B" | "C", Address> = {
    A: deployment.collectionA.address,
    B: deployment.collectionB.address,
    C: deployment.collectionC.address,
  };

  const account = privateKeyToAccount(deployerKey as `0x${string}`);
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });

  for (const wallet of wallets) {
    for (const key of wallet.collections) {
      const address = collectionAddress[key];
      console.log(`Minting Collection ${key} -> ${wallet.label} (${wallet.address})`);
      const hash = await walletClient.writeContract({
        address,
        abi: TEST_COLLECTION_ABI,
        functionName: "mint",
        args: [wallet.address],
        chain: null,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  tx: ${hash}`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
