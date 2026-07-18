// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Public onchain voting for NFT holders across multiple Monad
/// communities. One proposal, many communities: a poll targets a subset of
/// supported NFT collections (encoded as a bitmask); any wallet holding at
/// least one targeted collection may cast one Yes/No/Abstain vote.
///
/// Collection membership itself is never checked onchain — the collectionMask
/// arrives pre-verified in an EIP-712 proof signed by the trusted
/// `eligibilitySigner` (Holder Voices' own backend, which derives it from a
/// local NFT-ownership indexer). This keeps gas flat regardless of how many
/// collections the platform supports, and keeps per-collection vote
/// statistics entirely offchain (reconstructed from `VoteCast` logs).
///
/// This contract never holds funds, is never payable, and never touches NFTs
/// or treasuries — it only records who voted, what they chose, and which
/// collections they qualified through.
contract HolderVoices is EIP712, Ownable {
    using ECDSA for bytes32;

    enum Choice {
        Yes,
        No,
        Abstain
    }

    struct Poll {
        address author;
        uint64 createdAt;
        uint64 endsAt;
        uint32 allowedCollectionMask;
        uint32 yesCount;
        uint32 noCount;
        uint32 abstainCount;
        uint32 uniqueVoters;
        bytes32 metadataHash;
    }

    bytes32 private constant ELIGIBILITY_PROOF_TYPEHASH = keccak256(
        "EligibilityProof(uint256 pollId,address voter,uint32 collectionMask,uint64 ownershipCheckedAt,uint64 expiresAt,uint256 nonce)"
    );

    /// @notice Backend signer trusted to attest NFT-holding eligibility. Rotatable by the owner.
    address public eligibilitySigner;
    uint256 public nextPollId;

    mapping(uint256 pollId => Poll) public polls;
    mapping(uint256 pollId => mapping(address voter => bool)) public hasVoted;

    event PollCreated(
        uint256 indexed pollId, address indexed author, uint64 endsAt, uint32 allowedCollectionMask, bytes32 metadataHash
    );
    event VoteCast(uint256 indexed pollId, address indexed voter, uint8 choice, uint32 collectionMask, uint64 ownershipCheckedAt);
    event EligibilitySignerUpdated(address indexed previousSigner, address indexed newSigner);

    error PollNotFound(uint256 pollId);
    error PollEnded(uint256 pollId);
    error EndsAtNotInFuture(uint64 endsAt);
    error AlreadyVoted(uint256 pollId, address voter);
    error NoEligibleCollections();
    error CollectionNotAllowed(uint32 collectionMask, uint32 allowedCollectionMask);
    error ProofExpired(uint64 expiresAt, uint256 currentTime);
    error InvalidSigner(address recovered, address expected);
    error InvalidChoice(uint8 choice);

    constructor(address initialOwner, address initialEligibilitySigner) EIP712("HolderVoices", "1") Ownable(initialOwner) {
        eligibilitySigner = initialEligibilitySigner;
    }

    /// @notice Creates a poll open to any wallet holding at least one of `allowedCollectionMask`'s
    /// collections. Callable by anyone — Holder Voices polls are community-created, not admin-gated.
    /// @param metadataHash keccak256 of the offchain title/question/description, for integrity linking
    /// (the text itself lives in Holder Voices' database, not onchain, to keep this call cheap).
    function createPoll(bytes32 metadataHash, uint64 endsAt, uint32 allowedCollectionMask)
        external
        returns (uint256 pollId)
    {
        if (endsAt <= block.timestamp) revert EndsAtNotInFuture(endsAt);
        if (allowedCollectionMask == 0) revert NoEligibleCollections();

        pollId = nextPollId++;
        polls[pollId] = Poll({
            author: msg.sender,
            createdAt: uint64(block.timestamp),
            endsAt: endsAt,
            allowedCollectionMask: allowedCollectionMask,
            yesCount: 0,
            noCount: 0,
            abstainCount: 0,
            uniqueVoters: 0,
            metadataHash: metadataHash
        });

        emit PollCreated(pollId, msg.sender, endsAt, allowedCollectionMask, metadataHash);
    }

    /// @notice Casts one vote for `pollId`. `collectionMask`/`ownershipCheckedAt`/`expiresAt`/`nonce`/
    /// `signature` come from Holder Voices' `/api/eligibility/sign` endpoint — the proof is bound to
    /// `msg.sender` (the signed struct hash includes the caller's own address), this poll, this chain,
    /// and this contract, so it cannot be replayed by a different wallet, a different poll, or forged.
    function vote(
        uint256 pollId,
        uint8 choice,
        uint32 collectionMask,
        uint64 ownershipCheckedAt,
        uint64 expiresAt,
        uint256 nonce,
        bytes calldata signature
    ) external {
        Poll storage poll = polls[pollId];
        if (poll.endsAt == 0) revert PollNotFound(pollId);
        if (block.timestamp >= poll.endsAt) revert PollEnded(pollId);
        if (hasVoted[pollId][msg.sender]) revert AlreadyVoted(pollId, msg.sender);
        if (collectionMask == 0) revert NoEligibleCollections();
        if (collectionMask & poll.allowedCollectionMask == 0) {
            revert CollectionNotAllowed(collectionMask, poll.allowedCollectionMask);
        }
        if (block.timestamp > expiresAt) revert ProofExpired(expiresAt, block.timestamp);
        if (choice > uint8(Choice.Abstain)) revert InvalidChoice(choice);

        bytes32 structHash = keccak256(
            abi.encode(ELIGIBILITY_PROOF_TYPEHASH, pollId, msg.sender, collectionMask, ownershipCheckedAt, expiresAt, nonce)
        );
        address recovered = _hashTypedDataV4(structHash).recover(signature);
        if (recovered != eligibilitySigner) revert InvalidSigner(recovered, eligibilitySigner);

        hasVoted[pollId][msg.sender] = true;
        poll.uniqueVoters += 1;
        if (choice == uint8(Choice.Yes)) {
            poll.yesCount += 1;
        } else if (choice == uint8(Choice.No)) {
            poll.noCount += 1;
        } else {
            poll.abstainCount += 1;
        }

        emit VoteCast(pollId, msg.sender, choice, collectionMask, ownershipCheckedAt);
    }

    function getPoll(uint256 pollId) external view returns (Poll memory) {
        return polls[pollId];
    }

    /// @notice Derived, not stored — a poll is active iff it exists and its end time hasn't passed.
    function isActive(uint256 pollId) external view returns (bool) {
        Poll storage poll = polls[pollId];
        return poll.endsAt != 0 && block.timestamp < poll.endsAt;
    }

    /// @notice Rotates the trusted eligibility signer. Proofs already issued under the old signer
    /// stay valid only until their `expiresAt` (a few minutes) — no separate invalidation needed.
    function setEligibilitySigner(address newSigner) external onlyOwner {
        emit EligibilitySignerUpdated(eligibilitySigner, newSigner);
        eligibilitySigner = newSigner;
    }
}
