"use client";

import { useConnection, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "viem/chains";
import { shortAddress } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected, chainId } = useConnection();
  const { connectors, connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <button
        type="button"
        onClick={() => connector && connect({ connector })}
        disabled={connecting || !connector}
        className="rounded-full bg-success px-4 py-2 text-xs font-bold uppercase tracking-wide text-black transition hover:brightness-110 disabled:opacity-50"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  const wrongNetwork = chainId !== monadTestnet.id;

  return (
    <div className="flex items-center gap-2">
      {wrongNetwork && (
        <button
          type="button"
          onClick={() => switchChain({ chainId: monadTestnet.id })}
          disabled={switching}
          className="rounded-lg bg-warning px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
        >
          {switching ? "Switching…" : "Switch to Monad Testnet"}
        </button>
      )}
      <span
        className={`rounded-lg border border-border px-3 py-1.5 font-mono text-sm ${
          wrongNetwork ? "text-warning" : "text-foreground"
        }`}
      >
        {address && shortAddress(address)}
      </span>
      <button type="button" onClick={() => disconnect()} className="text-xs text-muted hover:text-foreground">
        Disconnect
      </button>
    </div>
  );
}
