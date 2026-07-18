// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Plain ERC-721 test collection with owner-gated minting, for local
/// Holder Voices development on Monad Testnet. Neutral placeholder — not a
/// real NFT project. TestCollectionA/B/C each deploy this with a different
/// name/symbol so the three test collections are independent contracts.
contract TestCollection is ERC721, Ownable {
    uint256 public nextTokenId;

    constructor(string memory name_, string memory symbol_, address initialOwner)
        ERC721(name_, symbol_)
        Ownable(initialOwner)
    {}

    /// @notice Mints the next sequential tokenId to `to`. Owner/test-admin only.
    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _mint(to, tokenId);
    }

    /// @notice Mints a specific tokenId to `to` — useful for deterministic test fixtures.
    function mintWithId(address to, uint256 tokenId) external onlyOwner {
        _mint(to, tokenId);
        if (tokenId >= nextTokenId) {
            nextTokenId = tokenId + 1;
        }
    }

    function burn(uint256 tokenId) external {
        require(_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId), "TestCollection: not owner nor approved");
        _burn(tokenId);
    }
}
