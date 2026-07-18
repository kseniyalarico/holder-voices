// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HolderVoices} from "../src/HolderVoices.sol";

/// @notice Deploys HolderVoices and writes its address + deploy block to
/// deployments/testnet/holder-voices.json.
///
/// Requires ELIGIBILITY_SIGNER_ADDRESS in the root .env (the backend's public
/// signing address — see web/.env.local ELIGIBILITY_SIGNER_PRIVATE_KEY for
/// the matching private key).
///
/// Run from contracts/:
///   source ../.env && forge script script/DeployVoting.s.sol \
///     --rpc-url monad_testnet --broadcast
contract DeployVoting is Script {
    function run() external {
        address eligibilitySigner = vm.envAddress("ELIGIBILITY_SIGNER_ADDRESS");

        vm.startBroadcast();
        address deployer = msg.sender;
        HolderVoices voting = new HolderVoices(deployer, eligibilitySigner);
        vm.stopBroadcast();

        uint256 deployBlock = block.number;

        string memory json = "holderVoices";
        vm.serializeAddress(json, "address", address(voting));
        vm.serializeUint(json, "deployBlock", deployBlock);
        vm.serializeUint(json, "chainId", block.chainid);
        string memory finalJson = vm.serializeAddress(json, "eligibilitySigner", eligibilitySigner);

        vm.writeJson(finalJson, "../deployments/testnet/holder-voices.json");

        console.log("HolderVoices deployed at:", address(voting));
        console.log("Deploy block:", deployBlock);
        console.log("Eligibility signer:", eligibilitySigner);
        console.log("");
        console.log("Next: copy this address into HOLDER_VOICES_ADDRESS (root .env)");
        console.log("and NEXT_PUBLIC_HOLDER_VOICES_ADDRESS / HOLDER_VOICES_ADDRESS (web/.env.local).");
    }
}
