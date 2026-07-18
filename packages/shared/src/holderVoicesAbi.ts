/**
 * HolderVoices ABI — copied from contracts/out/HolderVoices.sol/HolderVoices.json
 * after `forge build`. Re-copy after any change to contracts/src/HolderVoices.sol.
 */
export const HOLDER_VOICES_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "initialOwner", type: "address", internalType: "address" },
      { name: "initialEligibilitySigner", type: "address", internalType: "address" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createPoll",
    inputs: [
      { name: "metadataHash", type: "bytes32", internalType: "bytes32" },
      { name: "endsAt", type: "uint64", internalType: "uint64" },
      { name: "allowedCollectionMask", type: "uint32", internalType: "uint32" },
    ],
    outputs: [{ name: "pollId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "eligibilitySigner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPoll",
    inputs: [{ name: "pollId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct HolderVoices.Poll",
        components: [
          { name: "author", type: "address", internalType: "address" },
          { name: "createdAt", type: "uint64", internalType: "uint64" },
          { name: "endsAt", type: "uint64", internalType: "uint64" },
          { name: "allowedCollectionMask", type: "uint32", internalType: "uint32" },
          { name: "yesCount", type: "uint32", internalType: "uint32" },
          { name: "noCount", type: "uint32", internalType: "uint32" },
          { name: "abstainCount", type: "uint32", internalType: "uint32" },
          { name: "uniqueVoters", type: "uint32", internalType: "uint32" },
          { name: "metadataHash", type: "bytes32", internalType: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasVoted",
    inputs: [
      { name: "pollId", type: "uint256", internalType: "uint256" },
      { name: "voter", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isActive",
    inputs: [{ name: "pollId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextPollId",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setEligibilitySigner",
    inputs: [{ name: "newSigner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "vote",
    inputs: [
      { name: "pollId", type: "uint256", internalType: "uint256" },
      { name: "choice", type: "uint8", internalType: "uint8" },
      { name: "collectionMask", type: "uint32", internalType: "uint32" },
      { name: "ownershipCheckedAt", type: "uint64", internalType: "uint64" },
      { name: "expiresAt", type: "uint64", internalType: "uint64" },
      { name: "nonce", type: "uint256", internalType: "uint256" },
      { name: "signature", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "event", name: "EIP712DomainChanged", inputs: [], anonymous: false },
  {
    type: "event",
    name: "EligibilitySignerUpdated",
    inputs: [
      { name: "previousSigner", type: "address", indexed: true, internalType: "address" },
      { name: "newSigner", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true, internalType: "address" },
      { name: "newOwner", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PollCreated",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "author", type: "address", indexed: true, internalType: "address" },
      { name: "endsAt", type: "uint64", indexed: false, internalType: "uint64" },
      { name: "allowedCollectionMask", type: "uint32", indexed: false, internalType: "uint32" },
      { name: "metadataHash", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "voter", type: "address", indexed: true, internalType: "address" },
      { name: "choice", type: "uint8", indexed: false, internalType: "uint8" },
      { name: "collectionMask", type: "uint32", indexed: false, internalType: "uint32" },
      { name: "ownershipCheckedAt", type: "uint64", indexed: false, internalType: "uint64" },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyVoted",
    inputs: [
      { name: "pollId", type: "uint256", internalType: "uint256" },
      { name: "voter", type: "address", internalType: "address" },
    ],
  },
  {
    type: "error",
    name: "CollectionNotAllowed",
    inputs: [
      { name: "collectionMask", type: "uint32", internalType: "uint32" },
      { name: "allowedCollectionMask", type: "uint32", internalType: "uint32" },
    ],
  },
  { type: "error", name: "ECDSAInvalidSignature", inputs: [] },
  {
    type: "error",
    name: "ECDSAInvalidSignatureLength",
    inputs: [{ name: "length", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureS",
    inputs: [{ name: "s", type: "bytes32", internalType: "bytes32" }],
  },
  {
    type: "error",
    name: "EndsAtNotInFuture",
    inputs: [{ name: "endsAt", type: "uint64", internalType: "uint64" }],
  },
  {
    type: "error",
    name: "InvalidChoice",
    inputs: [{ name: "choice", type: "uint8", internalType: "uint8" }],
  },
  { type: "error", name: "InvalidShortString", inputs: [] },
  {
    type: "error",
    name: "InvalidSigner",
    inputs: [
      { name: "recovered", type: "address", internalType: "address" },
      { name: "expected", type: "address", internalType: "address" },
    ],
  },
  { type: "error", name: "NoEligibleCollections", inputs: [] },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "PollEnded",
    inputs: [{ name: "pollId", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "error",
    name: "PollNotFound",
    inputs: [{ name: "pollId", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "error",
    name: "ProofExpired",
    inputs: [
      { name: "expiresAt", type: "uint64", internalType: "uint64" },
      { name: "currentTime", type: "uint256", internalType: "uint256" },
    ],
  },
  {
    type: "error",
    name: "StringTooLong",
    inputs: [{ name: "str", type: "string", internalType: "string" }],
  },
] as const;
