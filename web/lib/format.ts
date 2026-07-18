export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const EXPLORER_BASE = process.env.NEXT_PUBLIC_MONADVISION_URL ?? "https://testnet.monadvision.com";

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}
