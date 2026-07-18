/**
 * Static MVP collection registry: names and bit positions only.
 * Deployed addresses / start blocks live in deployments/testnet/collections.json
 * and are mirrored into the `Collection` DB table by the deploy script — this
 * file is just the stable, human-chosen bit assignment referenced by both.
 */
export interface CollectionDefinition {
  key: "A" | "B" | "C";
  name: string;
  symbol: string;
  bitIndex: number;
}

export const MVP_COLLECTIONS: CollectionDefinition[] = [
  { key: "A", name: "Holder Voices Test Collection A", symbol: "HVTA", bitIndex: 0 },
  { key: "B", name: "Holder Voices Test Collection B", symbol: "HVTB", bitIndex: 1 },
  { key: "C", name: "Holder Voices Test Collection C", symbol: "HVTC", bitIndex: 2 },
];
