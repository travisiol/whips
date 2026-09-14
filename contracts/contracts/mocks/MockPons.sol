// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPonsFactoryV2} from "../interfaces/IPonsV2.sol";

/**
 * A small Pons V2 stand-in for unit tests: the same call shapes, a constant
 * product curve with the phantom quote, the 1% fee, the launch fee, the
 * economics hash check and the forwarder's ZeroAmount / value rules. The
 * real thing is exercised on a fork (scripts/fork-check.ts); this mock only
 * exists so the launcher's own rules can be tested quickly and offline.
 */
contract MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockCurve {
    using SafeERC20 for IERC20;

    uint256 public constant PHANTOM = 1.68 ether;
    uint256 public constant FEE_BPS = 100;
    uint256 public constant THRESHOLD = 4.2 ether;

    address public immutable token;
    address public immutable pairToken;
    address public immutable deployer;
    uint256 public immutable launchSupply;
    uint256 public realQuoteReserve;
    uint256 public tokenReserve;
    uint256 public quoteFeeBalance;
    bool public graduated;

    error NativeValueMismatch(uint256 value, uint256 amount);
    error Slippage();

    constructor(address token_, address pairToken_, address deployer_, uint256 supply) {
        token = token_;
        pairToken = pairToken_;
        deployer = deployer_;
        launchSupply = supply;
        tokenReserve = supply;
    }

    function getReserves() external view returns (uint256 quote, uint256 tokens) {
        return (PHANTOM + realQuoteReserve, tokenReserve);
    }

    function graduationThreshold() external pure returns (uint256) {
        return THRESHOLD;
    }

    function feeBps() external pure returns (uint256) {
        return FEE_BPS;
    }

    function buy(uint256 quoteAmount, uint256 minTokensOut, address recipient) external payable returns (uint256 out) {
        if (pairToken == address(0)) {
            if (msg.value != quoteAmount) revert NativeValueMismatch(msg.value, quoteAmount);
        } else {
            if (msg.value != 0) revert NativeValueMismatch(msg.value, 0);
            IERC20(pairToken).safeTransferFrom(msg.sender, address(this), quoteAmount);
        }
        uint256 fee = (quoteAmount * FEE_BPS) / 10_000;
        uint256 net = quoteAmount - fee;
        uint256 q = PHANTOM + realQuoteReserve;
        out = (tokenReserve * net) / (q + net);
        if (out < minTokensOut) revert Slippage();
        realQuoteReserve += net;
        quoteFeeBalance += fee;
        tokenReserve -= out;
        IERC20(token).safeTransfer(recipient, out);
        if (realQuoteReserve >= THRESHOLD) graduated = true;
    }

    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) external returns (uint256 out) {
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokensIn);
        uint256 q = PHANTOM + realQuoteReserve;
        uint256 gross = (q * tokensIn) / (tokenReserve + tokensIn);
        uint256 fee = (gross * FEE_BPS) / 10_000;
        out = gross - fee;
        if (out < minQuoteOut) revert Slippage();
        realQuoteReserve -= gross;
        quoteFeeBalance += fee;
        tokenReserve += tokensIn;
        if (pairToken == address(0)) {
            (bool ok,) = recipient.call{value: out}("");
            require(ok, "send");
        } else {
            IERC20(pairToken).safeTransfer(recipient, out);
        }
    }
}

contract MockPonsFactory {
    uint256 public constant LAUNCH_SUPPLY = 1_000_000_000 ether;
    uint256 public launchFee = 0.0005 ether;
    bool public launchEnabled = true;
    address public launchForwarder;
    address public feeEscrow;

    struct Launched {
        address token;
        address curve;
        address creatorFeeRecipient;
        uint16 creatorTaxBps;
        bool buybackEnabled;
        address sender;
    }

    mapping(bytes32 salt => Launched) public launches;
    uint256 public count;

    event TokenLaunched(address indexed token, address indexed curve, address indexed sender, bytes32 salt);

    error BadEconomics();
    error BadFee();
    error SaltUsed();

    constructor() {
        feeEscrow = address(this);
    }

    function setForwarder(address fwd) external {
        launchForwarder = fwd;
    }

    function canLaunch(address) external pure returns (bool) {
        return true;
    }

    function maxCreatorTaxBps() external pure returns (uint256) {
        return 1000;
    }

    function previewLaunchEconomics(uint256 configId, address pairToken) public pure returns (bytes32) {
        return keccak256(abi.encode("economics", configId, pairToken));
    }

    function launchToken(
        IPonsFactoryV2.LaunchParams calldata p,
        uint256 configId,
        address pairToken,
        address[] calldata
    ) external payable returns (address token, address curve) {
        if (msg.value != launchFee) revert BadFee();
        if (p.economicsHash != previewLaunchEconomics(configId, pairToken)) revert BadEconomics();
        if (launches[p.salt].token != address(0)) revert SaltUsed();
        // CREATE2 on the salt alone, so the same salt is the same address —
        // whether the real factory does this is checked on the fork.
        MockERC20 t = new MockERC20{salt: p.salt}(p.name, p.symbol);
        token = address(t);
        MockCurve c = new MockCurve(token, pairToken, p.creatorFeeRecipient, LAUNCH_SUPPLY);
        curve = address(c);
        t.mint(curve, LAUNCH_SUPPLY);
        launches[p.salt] = Launched({
            token: token,
            curve: curve,
            creatorFeeRecipient: p.creatorFeeRecipient,
            creatorTaxBps: p.creatorTaxBps,
            buybackEnabled: p.buybackEnabled,
            sender: msg.sender
        });
        count++;
        emit TokenLaunched(token, curve, msg.sender, p.salt);
    }
}

contract MockLaunchForwarder {
    using SafeERC20 for IERC20;

    MockPonsFactory public immutable factory;

    error ZeroAmount();
    error NativeValueMismatch(uint256 value, uint256 expected);

    constructor(MockPonsFactory f) {
        factory = f;
    }

    function launchAndBuy(
        IPonsFactoryV2.LaunchParams calldata p,
        uint256 configId,
        address pairToken,
        uint256 buyAmount,
        uint256 minTokensOut,
        address buyRecipient,
        address[] calldata exempt
    ) external payable returns (address token, address curve) {
        if (buyAmount == 0) revert ZeroAmount();
        uint256 fee = factory.launchFee();
        if (pairToken == address(0)) {
            if (msg.value != fee + buyAmount) revert NativeValueMismatch(msg.value, fee + buyAmount);
            (token, curve) = factory.launchToken{value: fee}(p, configId, pairToken, exempt);
            MockCurve(curve).buy{value: buyAmount}(buyAmount, minTokensOut, buyRecipient);
        } else {
            if (msg.value != fee) revert NativeValueMismatch(msg.value, fee);
            IERC20(pairToken).safeTransferFrom(msg.sender, address(this), buyAmount);
            (token, curve) = factory.launchToken{value: fee}(p, configId, pairToken, exempt);
            IERC20(pairToken).forceApprove(curve, buyAmount);
            MockCurve(curve).buy(buyAmount, minTokensOut, buyRecipient);
        }
    }
}
