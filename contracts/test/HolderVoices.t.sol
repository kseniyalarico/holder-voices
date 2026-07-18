// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {HolderVoices} from "../src/HolderVoices.sol";

contract HolderVoicesTest is Test {
    HolderVoices voting;

    uint256 signerPrivateKey = 0xA11CE5A17;
    address signer;
    uint256 attackerPrivateKey = 0xBADBADBAD;

    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    bytes32 constant ELIGIBILITY_PROOF_TYPEHASH = keccak256(
        "EligibilityProof(uint256 pollId,address voter,uint32 collectionMask,uint64 ownershipCheckedAt,uint64 expiresAt,uint256 nonce)"
    );
    bytes32 constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    uint32 constant MASK_A = 1; // bit 0
    uint32 constant MASK_B = 2; // bit 1
    uint32 constant MASK_C = 4; // bit 2

    function setUp() public {
        signer = vm.addr(signerPrivateKey);
        voting = new HolderVoices(owner, signer);
    }

    // ---- helpers ----

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256(bytes("HolderVoices")), keccak256(bytes("1")), block.chainid, address(voting)
            )
        );
    }

    function _digest(
        uint256 pollId,
        address voter,
        uint32 collectionMask,
        uint64 ownershipCheckedAt,
        uint64 expiresAt,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 structHash =
            keccak256(abi.encode(ELIGIBILITY_PROOF_TYPEHASH, pollId, voter, collectionMask, ownershipCheckedAt, expiresAt, nonce));
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function _sign(
        uint256 privateKey,
        uint256 pollId,
        address voter,
        uint32 collectionMask,
        uint64 ownershipCheckedAt,
        uint64 expiresAt,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 digest = _digest(pollId, voter, collectionMask, ownershipCheckedAt, expiresAt, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _createPoll(uint32 allowedMask) internal returns (uint256 pollId) {
        pollId = voting.createPoll(keccak256("poll metadata"), uint64(block.timestamp + 1 days), allowedMask);
    }

    // ---- createPoll ----

    function test_CreatePoll_Valid() public {
        uint256 pollId = _createPoll(MASK_A | MASK_C);
        HolderVoices.Poll memory poll = voting.getPoll(pollId);
        assertEq(poll.author, owner);
        assertEq(poll.allowedCollectionMask, MASK_A | MASK_C);
        assertTrue(voting.isActive(pollId));
    }

    function test_CreatePoll_RevertsIfEndsAtInPast() public {
        vm.expectRevert(abi.encodeWithSelector(HolderVoices.EndsAtNotInFuture.selector, uint64(block.timestamp)));
        voting.createPoll(keccak256("x"), uint64(block.timestamp), MASK_A);
    }

    // ---- vote: happy paths ----

    function test_Vote_SingleCollection() public {
        uint256 pollId = _createPoll(MASK_A | MASK_B | MASK_C);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        bytes memory sig = _sign(signerPrivateKey, pollId, alice, MASK_A, uint64(block.timestamp), expiresAt, 1);

        vm.prank(alice);
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_A, uint64(block.timestamp), expiresAt, 1, sig);

        HolderVoices.Poll memory poll = voting.getPoll(pollId);
        assertEq(poll.yesCount, 1);
        assertEq(poll.uniqueVoters, 1);
        assertTrue(voting.hasVoted(pollId, alice));
    }

    function test_Vote_MultiCollectionMask() public {
        uint256 pollId = _createPoll(MASK_A | MASK_B | MASK_C);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        uint32 mask = MASK_B | MASK_C;
        bytes memory sig = _sign(signerPrivateKey, pollId, bob, mask, uint64(block.timestamp), expiresAt, 7);

        vm.prank(bob);
        voting.vote(pollId, uint8(HolderVoices.Choice.No), mask, uint64(block.timestamp), expiresAt, 7, sig);

        HolderVoices.Poll memory poll = voting.getPoll(pollId);
        assertEq(poll.noCount, 1);
        assertEq(poll.uniqueVoters, 1);
    }

    function test_Vote_EmitsVoteCastWithCorrectData() public {
        uint256 pollId = _createPoll(MASK_A);
        uint64 checkedAt = uint64(block.timestamp);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        bytes memory sig = _sign(signerPrivateKey, pollId, alice, MASK_A, checkedAt, expiresAt, 1);

        vm.expectEmit(true, true, false, true, address(voting));
        emit HolderVoices.VoteCast(pollId, alice, uint8(HolderVoices.Choice.Abstain), MASK_A, checkedAt);

        vm.prank(alice);
        voting.vote(pollId, uint8(HolderVoices.Choice.Abstain), MASK_A, checkedAt, expiresAt, 1, sig);
    }

    // ---- vote: rejections ----

    function test_Vote_RevertsOnDoubleVote() public {
        uint256 pollId = _createPoll(MASK_A);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        bytes memory sig1 = _sign(signerPrivateKey, pollId, alice, MASK_A, uint64(block.timestamp), expiresAt, 1);

        vm.prank(alice);
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_A, uint64(block.timestamp), expiresAt, 1, sig1);

        bytes memory sig2 = _sign(signerPrivateKey, pollId, alice, MASK_A, uint64(block.timestamp), expiresAt, 2);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HolderVoices.AlreadyVoted.selector, pollId, alice));
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_A, uint64(block.timestamp), expiresAt, 2, sig2);
    }

    function test_Vote_RevertsIfNoEligibleCollections() public {
        uint256 pollId = _createPoll(MASK_A | MASK_B);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        // Signer legitimately attests a wallet holds none of the supported collections (mask = 0).
        bytes memory sig = _sign(signerPrivateKey, pollId, alice, 0, uint64(block.timestamp), expiresAt, 1);

        vm.prank(alice);
        vm.expectRevert(HolderVoices.NoEligibleCollections.selector);
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), 0, uint64(block.timestamp), expiresAt, 1, sig);
    }

    function test_Vote_RevertsIfCollectionNotAllowedByPoll() public {
        uint256 pollId = _createPoll(MASK_A); // poll only allows Collection A
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        // Alice legitimately holds Collection C, but C isn't part of this poll.
        bytes memory sig = _sign(signerPrivateKey, pollId, alice, MASK_C, uint64(block.timestamp), expiresAt, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HolderVoices.CollectionNotAllowed.selector, MASK_C, MASK_A));
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_C, uint64(block.timestamp), expiresAt, 1, sig);
    }

    function test_Vote_RevertsOnForgedSignature() public {
        uint256 pollId = _createPoll(MASK_A);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        // Signed by a random attacker key, not the configured eligibilitySigner.
        bytes memory sig = _sign(attackerPrivateKey, pollId, alice, MASK_A, uint64(block.timestamp), expiresAt, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HolderVoices.InvalidSigner.selector, vm.addr(attackerPrivateKey), signer));
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_A, uint64(block.timestamp), expiresAt, 1, sig);
    }

    function test_Vote_RevertsIfSignatureIssuedForDifferentWallet() public {
        uint256 pollId = _createPoll(MASK_A);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        // Proof was signed attesting Bob's eligibility, but Alice tries to submit it as her own vote.
        bytes memory sig = _sign(signerPrivateKey, pollId, bob, MASK_A, uint64(block.timestamp), expiresAt, 1);

        vm.prank(alice);
        vm.expectRevert(); // digest differs (msg.sender baked in) -> recovers to an address != signer
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_A, uint64(block.timestamp), expiresAt, 1, sig);
    }

    function test_Vote_RevertsIfProofExpired() public {
        uint256 pollId = _createPoll(MASK_A);
        uint64 expiresAt = uint64(block.timestamp + 1);
        bytes memory sig = _sign(signerPrivateKey, pollId, alice, MASK_A, uint64(block.timestamp), expiresAt, 1);

        vm.warp(block.timestamp + 2 minutes);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HolderVoices.ProofExpired.selector, expiresAt, block.timestamp));
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_A, uint64(block.timestamp), expiresAt, 1, sig);
    }

    function test_Vote_RevertsIfCollectionMaskTamperedAfterSigning() public {
        uint256 pollId = _createPoll(MASK_A | MASK_B);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        // Signed for mask = A only...
        bytes memory sig = _sign(signerPrivateKey, pollId, alice, MASK_A, uint64(block.timestamp), expiresAt, 1);

        // ...but submitted claiming mask = A | B (would let Alice's vote count toward Collection B too).
        vm.prank(alice);
        vm.expectRevert(); // recovered signer != eligibilitySigner because the signed struct hash changes
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_A | MASK_B, uint64(block.timestamp), expiresAt, 1, sig);
    }

    function test_Vote_RevertsAfterPollEnds() public {
        uint256 pollId = _createPoll(MASK_A);
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        bytes memory sig = _sign(signerPrivateKey, pollId, alice, MASK_A, uint64(block.timestamp), expiresAt, 1);

        vm.warp(block.timestamp + 2 days);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HolderVoices.PollEnded.selector, pollId));
        voting.vote(pollId, uint8(HolderVoices.Choice.Yes), MASK_A, uint64(block.timestamp), expiresAt, 1, sig);
    }

    function test_Vote_RevertsOnUnknownPoll() public {
        uint64 expiresAt = uint64(block.timestamp + 5 minutes);
        bytes memory sig = _sign(signerPrivateKey, 999, alice, MASK_A, uint64(block.timestamp), expiresAt, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HolderVoices.PollNotFound.selector, uint256(999)));
        voting.vote(999, uint8(HolderVoices.Choice.Yes), MASK_A, uint64(block.timestamp), expiresAt, 1, sig);
    }

    // ---- admin ----

    function test_SetEligibilitySigner_OnlyOwner() public {
        address newSigner = address(0x5151);
        voting.setEligibilitySigner(newSigner);
        assertEq(voting.eligibilitySigner(), newSigner);

        vm.prank(alice);
        vm.expectRevert();
        voting.setEligibilitySigner(alice);
    }
}
