/** Mirrors the `Choice` enum in HolderVoices.sol — keep in sync. */
export enum Choice {
  Yes = 0,
  No = 1,
  Abstain = 2,
}

export const CHOICE_LABELS: Record<Choice, string> = {
  [Choice.Yes]: "Yes",
  [Choice.No]: "No",
  [Choice.Abstain]: "Abstain",
};

export function isValidChoice(value: number): value is Choice {
  return value === Choice.Yes || value === Choice.No || value === Choice.Abstain;
}
