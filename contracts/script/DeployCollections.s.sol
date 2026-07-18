// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {TestCollection} from "../src/TestCollection.sol";

/// @notice Deploys the three MVP test NFT collections (bit 0/1/2) and writes
/// their addresses + current block (as startBlock for the NFT indexer) to
/// deployments/testnet/collections.json.
///
/// Run from contracts/:
///   source ../.env && forge script script/DeployCollections.s.sol \
///     --rpc-url monad_testnet --broadcast
contract DeployCollections is Script {
    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        TestCollection collectionA = new TestCollection("Holder Voices Test Collection A", "HVTA", deployer);
        TestCollection collectionB = new TestCollection("Holder Voices Test Collection B", "HVTB", deployer);
        TestCollection collectionC = new TestCollection("Holder Voices Test Collection C", "HVTC", deployer);

        vm.stopBroadcast();

        uint256 startBlock = block.number;

        string memory json = "collections";
        vm.serializeString(json, "networkChainId", vm.toString(block.chainid));

        string memory a = "collectionA";
        vm.serializeString(a, "name", "Holder Voices Test Collection A");
        vm.serializeUint(a, "bitIndex", 0);
        vm.serializeUint(a, "startBlock", startBlock);
        string memory aJson = vm.serializeAddress(a, "address", address(collectionA));

        string memory b = "collectionB";
        vm.serializeString(b, "name", "Holder Voices Test Collection B");
        vm.serializeUint(b, "bitIndex", 1);
        vm.serializeUint(b, "startBlock", startBlock);
        string memory bJson = vm.serializeAddress(b, "address", address(collectionB));

        string memory c = "collectionC";
        vm.serializeString(c, "name", "Holder Voices Test Collection C");
        vm.serializeUint(c, "bitIndex", 2);
        vm.serializeUint(c, "startBlock", startBlock);
        string memory cJson = vm.serializeAddress(c, "address", address(collectionC));

        vm.serializeString(json, "collectionA", aJson);
        vm.serializeString(json, "collectionB", bJson);
        string memory finalJson = vm.serializeString(json, "collectionC", cJson);

        vm.writeJson(finalJson, "../deployments/testnet/collections.json");

        console.log("Collection A:", address(collectionA));
        console.log("Collection B:", address(collectionB));
        console.log("Collection C:", address(collectionC));
        console.log("Start block:", startBlock);
    }
}
