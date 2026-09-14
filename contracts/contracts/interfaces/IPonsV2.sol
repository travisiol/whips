// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * Pons V2 on Robinhood Chain — the surface WHIPS touches.
 *
 * Layouts were read off the deployed contracts and confirmed by tracing real
 * launches on a fork: the factory at 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e,
 * its launch forwarder, live curves and the fee escrow. Field NAMES inside
 * the structs are ours; the ORDER and TYPES are what the chain accepts.
 */
interface IPonsFactoryV2 {
    struct Socials {
        string x;
        string telegram;
        string website;
        string discord;
        string extra;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string logo;
        string description;
        Socials socials;
        /// Receives the token's creator fees. NOT the pair token.
        address creatorFeeRecipient;
        uint16 creatorTaxBps;
        bool buybackEnabled;
        /// previewLaunchEconomics(configId, pairToken) at call time — the
        /// factory rejects a launch whose economics moved under it.
        bytes32 economicsHash;
        /// CREATE2 salt for the token address.
        bytes32 salt;
    }

    /// `pairToken` is address(0) for a native-ETH curve. The caller becomes
    /// the token's deployer; it and the fee recipient are exempted from the
    /// snipe tax, plus everyone in `snipeTaxExempt`.
    function launchToken(
        LaunchParams calldata params,
        uint256 launchConfigId,
        address pairToken,
        address[] calldata snipeTaxExempt
    ) external payable returns (address token, address curve);

    function launchFee() external view returns (uint256);

    function launchEnabled() external view returns (bool);

    function canLaunch(address launcher) external view returns (bool);

    function feeEscrow() external view returns (address);

    function launchForwarder() external view returns (address);

    function maxCreatorTaxBps() external view returns (uint256);

    function previewLaunchEconomics(uint256 launchConfigId, address pairToken) external view returns (bytes32);
}

/// Pons' own helper: launch and buy the first allocation atomically, with
/// the buyer exempted from the snipe tax first. For a native curve the
/// value is launchFee + buyAmount; for an ERC-20 pair it is launchFee and
/// the forwarder pulls `buyAmount` of the pair token from the caller.
interface IPonsLaunchForwarder {
    function launchAndBuy(
        IPonsFactoryV2.LaunchParams calldata params,
        uint256 launchConfigId,
        address pairToken,
        uint256 buyAmount,
        uint256 minTokensOut,
        address buyRecipient,
        address[] calldata snipeTaxExempt
    ) external payable returns (address token, address curve);
}

/// The bonding curve deployed per token.
interface IPonsCurve {
    /// (quoteReserve, tokenReserve) — quote includes the virtual liquidity.
    function getReserves() external view returns (uint256 quote, uint256 tokens);

    /// Quote actually raised so far; graduation triggers at graduationThreshold.
    function realQuoteReserve() external view returns (uint256);

    function graduationThreshold() external view returns (uint256);

    function graduated() external view returns (bool);

    function token() external view returns (address);

    function pairToken() external view returns (address);

    function launchSupply() external view returns (uint256);

    function buy(uint256 quoteAmount, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensOut);

    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) external returns (uint256 quoteOut);
}

/// Creator fees accrue here, credited to the creator-fee recipient.
interface IPonsFeeEscrow {
    function balanceOf(address account) external view returns (uint256);

    function balanceOfToken(address token, address account) external view returns (uint256);

    function claim() external;

    function claimToken(address token) external;
}
