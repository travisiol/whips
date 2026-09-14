// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPonsFactoryV2, IPonsLaunchForwarder} from "./interfaces/IPonsV2.sol";

/**
 * WHIPS — one token per iconic car, on Pons V2 (Robinhood Chain).
 *
 * The catalog is fixed off-chain and committed here as a Merkle root: a car
 * can only be claimed with its real identity (id, name, ticker, pair), and
 * only once. The launch itself is Pons' own forwarder call — launch and
 * first buy in one transaction — with the caller as creator-fee recipient
 * and buy recipient. No platform token, no platform fee: the launcher is a
 * gate and a registry, nothing else.
 *
 * Immutable by design. There is no owner, nothing to pause, nothing to
 * sweep; a wrong root means a new deployment.
 */
contract WhipsLauncher is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Claim {
        address token;
        address curve;
        address launcher;
    }

    /// Identifies this launcher's namespace inside the CREATE2 salt.
    string public constant SLUG = "whips";

    IPonsFactoryV2 public immutable factory;
    IPonsLaunchForwarder public immutable forwarder;
    /// Root of the catalog: leaves are keccak256(bytes.concat(keccak256(abi.encode(itemId, name, symbol, pairToken)))).
    bytes32 public immutable catalogRoot;

    mapping(uint256 itemId => Claim) public claims;
    uint256[] private _claimedIds;

    event ItemClaimed(
        uint256 indexed itemId,
        address indexed token,
        address curve,
        address indexed launcher,
        address pairToken,
        string symbol
    );

    error AlreadyClaimed(uint256 itemId);
    error InvalidProof(uint256 itemId);
    error ZeroAmount();
    error NativeValueMismatch(uint256 expected, uint256 actual);
    error ZeroAddress();

    constructor(address factory_, bytes32 catalogRoot_) {
        if (factory_ == address(0)) revert ZeroAddress();
        if (catalogRoot_ == bytes32(0)) revert ZeroAddress();
        factory = IPonsFactoryV2(factory_);
        address fwd = IPonsFactoryV2(factory_).launchForwarder();
        if (fwd == address(0)) revert ZeroAddress();
        forwarder = IPonsLaunchForwarder(fwd);
        catalogRoot = catalogRoot_;
    }

    // ── Launch ─────────────────────────────────────────────────────────

    /**
     * Claim `itemId` and launch its token, buying `buyAmount` of quote in
     * the same transaction.
     *
     * Native pair (pairToken == address(0)): msg.value must equal
     * factory.launchFee() + buyAmount. ERC-20 pair: msg.value must equal
     * factory.launchFee(), and the caller must have approved `buyAmount`
     * of the pair token to this contract.
     *
     * The token's creator-fee recipient and the buy recipient are both
     * msg.sender; buybacks are on; the salt is keccak256(abi.encode(SLUG,
     * itemId)), so the same car always maps to the same salt.
     */
    function launch(
        uint256 itemId,
        string calldata name,
        string calldata symbol,
        address pairToken,
        bytes32[] calldata proof,
        string calldata logo,
        string calldata description,
        string[5] calldata socials,
        uint16 creatorTaxBps,
        uint256 configId,
        uint256 buyAmount,
        uint256 minTokensOut
    ) external payable nonReentrant returns (address token, address curve) {
        if (buyAmount == 0) revert ZeroAmount();
        if (claims[itemId].token != address(0)) revert AlreadyClaimed(itemId);
        if (!MerkleProof.verifyCalldata(proof, catalogRoot, leafFor(itemId, name, symbol, pairToken))) {
            revert InvalidProof(itemId);
        }

        uint256 fee = factory.launchFee();
        uint256 value;
        if (pairToken == address(0)) {
            if (msg.value != fee + buyAmount) revert NativeValueMismatch(fee + buyAmount, msg.value);
            value = msg.value;
        } else {
            if (msg.value != fee) revert NativeValueMismatch(fee, msg.value);
            IERC20(pairToken).safeTransferFrom(msg.sender, address(this), buyAmount);
            IERC20(pairToken).forceApprove(address(forwarder), buyAmount);
            value = fee;
        }

        IPonsFactoryV2.LaunchParams memory params = IPonsFactoryV2.LaunchParams({
            name: name,
            symbol: symbol,
            logo: logo,
            description: description,
            socials: IPonsFactoryV2.Socials({
                x: socials[0],
                telegram: socials[1],
                website: socials[2],
                discord: socials[3],
                extra: socials[4]
            }),
            creatorFeeRecipient: msg.sender,
            creatorTaxBps: creatorTaxBps,
            buybackEnabled: true,
            economicsHash: factory.previewLaunchEconomics(configId, pairToken),
            salt: saltFor(itemId)
        });

        address[] memory exempt = new address[](0);
        (token, curve) = forwarder.launchAndBuy{value: value}(
            params, configId, pairToken, buyAmount, minTokensOut, msg.sender, exempt
        );

        claims[itemId] = Claim({token: token, curve: curve, launcher: msg.sender});
        _claimedIds.push(itemId);
        emit ItemClaimed(itemId, token, curve, msg.sender, pairToken, symbol);
    }

    // ── Views ──────────────────────────────────────────────────────────

    function isClaimed(uint256 itemId) external view returns (bool) {
        return claims[itemId].token != address(0);
    }

    function claimCount() external view returns (uint256) {
        return _claimedIds.length;
    }

    /// Item ids in claim order, `offset`-based so a reader can page.
    function claimedIds(uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        uint256 n = _claimedIds.length;
        if (offset >= n) return ids;
        uint256 end = offset + limit;
        if (end > n || limit == 0) end = n;
        ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _claimedIds[i];
        }
    }

    /// The leaf the catalog root commits to, for off-chain proof building.
    function leafFor(uint256 itemId, string calldata name, string calldata symbol, address pairToken)
        public
        pure
        returns (bytes32)
    {
        return keccak256(bytes.concat(keccak256(abi.encode(itemId, name, symbol, pairToken))));
    }

    /// The CREATE2 salt the factory receives for `itemId`.
    function saltFor(uint256 itemId) public pure returns (bytes32) {
        return keccak256(abi.encode(SLUG, itemId));
    }

    /// Pons' launch fee right now (0.0005 ETH at the time of writing).
    function ponsLaunchFee() external view returns (uint256) {
        return factory.launchFee();
    }

    /// What the caller must send as value for a launch with `buyAmount`.
    function valueFor(address pairToken, uint256 buyAmount) external view returns (uint256) {
        uint256 fee = factory.launchFee();
        return pairToken == address(0) ? fee + buyAmount : fee;
    }
}
