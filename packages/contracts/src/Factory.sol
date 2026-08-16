// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/token/ERC20/IERC20.sol";
import { Token } from "./Token.sol";

/// @title Factory — deploys launch tokens and registers launches.
/// @notice Deploys a `Token`, assigns the Launchpad as owner so it can release
///         supply to buyers, and records the launch (creator, metadata hash).
///         Emits `TokenCreated` consumed by the off-chain indexer.
contract Factory is Ownable {
    /// @notice Fired when a new token is deployed through the launchpad.
    /// @param token deployed token address
    /// @param creator user who initiated the launch
    /// @param name_ token name
    /// @param symbol_ token symbol
    /// @param totalSupply full fixed supply (18dp)
    /// @param curveType 0 = constant-product virtual reserves
    /// @param metaHash off-chain metadata reference (IPFS/URI)
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name_,
        string symbol_,
        uint256 totalSupply,
        uint8 curveType,
        string metaHash
    );

    /// @notice Registry of every launched token.
    mapping(address => bool) public isLaunched;

    constructor() Ownable(msg.sender) {}

    /// @notice Deploy + register a token. Called by the Launchpad.
    /// @dev Mints full supply to `msg.sender` (the Launchpad), fixing supply.
    ///      No access control: the Factory is passive infra and the Launchpad
    ///      is the only contract that holds its address + registers curves.
    function deployToken(
        address creator,
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_,
        uint256 totalSupply,
        uint8 curveType,
        string calldata metaHash
    ) external returns (address token) {
        Token t = new Token(name_, symbol_, decimals_, totalSupply, msg.sender);
        token = address(t);
        isLaunched[token] = true;
        emit TokenCreated(token, creator, name_, symbol_, totalSupply, curveType, metaHash);
    }
}
