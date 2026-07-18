import { http, createConfig } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { monadTestnet } from "viem/chains";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [
    injected(),
    // Only added if a WalletConnect Cloud project id is configured — MetaMask/
    // Rabby/other browser-extension wallets already work via `injected()` alone.
    ...(walletConnectProjectId ? [walletConnect({ projectId: walletConnectProjectId })] : []),
  ],
  transports: {
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL ?? monadTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
