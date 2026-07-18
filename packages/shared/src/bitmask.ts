/** Bitmask helpers shared by the backend, indexers, and contract tests. */

export function bitFor(bitIndex: number): number {
  if (bitIndex < 0 || bitIndex > 31) {
    throw new Error(`bitIndex out of range: ${bitIndex}`);
  }
  return 1 << bitIndex;
}

export function maskIncludes(mask: number, bitIndex: number): boolean {
  return (mask & bitFor(bitIndex)) !== 0;
}

export function combineMask(bitIndexes: number[]): number {
  return bitIndexes.reduce((mask, bitIndex) => mask | bitFor(bitIndex), 0);
}

/** Bit indexes present in a mask, e.g. 0b101 -> [0, 2]. */
export function bitsInMask(mask: number): number[] {
  const bits: number[] = [];
  for (let i = 0; i < 32; i++) {
    if (maskIncludes(mask, i)) bits.push(i);
  }
  return bits;
}
