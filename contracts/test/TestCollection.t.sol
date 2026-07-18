// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {TestCollection} from "../src/TestCollection.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract TestCollectionTest is Test {
    TestCollection collection;
    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        collection = new TestCollection("Holder Voices Test Collection A", "HVTA", owner);
    }

    function test_MintIncrementsSequentialTokenId() public {
        uint256 id0 = collection.mint(alice);
        uint256 id1 = collection.mint(alice);
        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(collection.balanceOf(alice), 2);
        assertEq(collection.ownerOf(0), alice);
        assertEq(collection.ownerOf(1), alice);
    }

    function test_OnlyOwnerCanMint() public {
        vm.prank(alice);
        vm.expectRevert();
        collection.mint(bob);
    }

    function test_MintWithIdAdvancesNextTokenId() public {
        collection.mintWithId(alice, 100);
        assertEq(collection.ownerOf(100), alice);
        uint256 nextId = collection.mint(bob);
        assertEq(nextId, 101);
    }

    function test_TransferMovesOwnership() public {
        collection.mint(alice);
        vm.prank(alice);
        collection.transferFrom(alice, bob, 0);
        assertEq(collection.ownerOf(0), bob);
        assertEq(collection.balanceOf(alice), 0);
        assertEq(collection.balanceOf(bob), 1);
    }

    function test_BurnRemovesToken() public {
        collection.mint(alice);
        vm.prank(alice);
        collection.burn(0);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 0));
        collection.ownerOf(0);
        assertEq(collection.balanceOf(alice), 0);
    }

    function test_BurnRequiresOwnerOrApproved() public {
        collection.mint(alice);
        vm.prank(bob);
        vm.expectRevert();
        collection.burn(0);
    }
}
