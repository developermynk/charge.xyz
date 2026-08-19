// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ArcSwapMulti
/// @notice Inventory-backed multi-token swap vault for Arc Testnet.
///        Lets users swap USDC <-> EURC <-> cirBTC atomically. Quotes are
///        derived from owner-set USD prices (live FX / BTC rate), not an AMM
///        curve, so it works even when no on-chain AMM pool exists for a pair.
///        The vault holds the inventory of every supported token; swaps pull
///        `from` and send `to` in the same transaction.
import { IERC20 } from "@openzeppelin/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/utils/ReentrancyGuard.sol";

contract ArcSwapMulti is Ownable, ReentrancyGuard {
    /// @notice Native Arc USDC sentinel: zero address means "use msg.value".
    address public constant NATIVE_USDC = 0x3600000000000000000000000000000000000000;

    struct TokenInfo {
        bool supported;
        uint8 decimals;
        bool isNative; // true => Arc native USDC (transacted via msg.value)
    }

    mapping(address => TokenInfo) public tokens;
    /// @notice USD price of 1.0 whole token, in 1e18 scale (8dp irrelevant; we use 1e18).
    mapping(address => uint256) public price18;
    uint256 public feeBps; // swap fee in basis points (owner-settable)

    event Swap(
        address indexed user,
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );
    event TokenAdded(address indexed token, uint8 decimals, bool isNative);
    event PriceSet(address indexed token, uint256 price18);
    event LiquidityAdded(address indexed token, uint256 amount);
    event FeeSet(uint256 feeBps);

    error NotSupported(address token);
    error InsufficientOut(uint256 minOut, uint256 got);
    error InsufficientInventory(uint256 have, uint256 need);
    error BadDecimals();

    constructor() Ownable(msg.sender) {
        feeBps = 30; // 0.30% default
    }

    // ---- owner config ----
    function addToken(address token, uint8 decimals, bool isNative) external onlyOwner {
        if (decimals == 0) revert BadDecimals();
        tokens[token] = TokenInfo(true, decimals, isNative);
        emit TokenAdded(token, decimals, isNative);
    }

    function setPrice(address token, uint256 _price18) external onlyOwner {
        if (!tokens[token].supported) revert NotSupported(token);
        price18[token] = _price18;
        emit PriceSet(token, _price18);
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "fee too high"); // max 10%
        feeBps = _feeBps;
        emit FeeSet(_feeBps);
    }

    /// @notice Owner funds the vault with ERC-20 inventory (native USDC via msg.value).
    function addLiquidity(address token, uint256 amount) external payable onlyOwner {
        TokenInfo storage t = tokens[token];
        if (!t.supported) revert NotSupported(token);
        if (t.isNative) {
            require(msg.value == amount, "native: msg.value mismatch");
        } else {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }
        emit LiquidityAdded(token, amount);
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        _send(token, msg.sender, amount);
    }

    // ---- read ----
    function vaultBalance(address token) external view returns (uint256) {
        TokenInfo storage t = tokens[token];
        if (t.isNative) return address(this).balance;
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Quote output amount for a swap (no fee applied here; fee applied in swap()).
    function quote(address fromToken, address toToken, uint256 amountIn)
        external
        view
        returns (uint256)
    {
        TokenInfo storage f = tokens[fromToken];
        TokenInfo storage t = tokens[toToken];
        if (!f.supported) revert NotSupported(fromToken);
        if (!t.supported) revert NotSupported(toToken);
        if (amountIn == 0) return 0;
        // USD value of input, normalized to 1e18.
        uint256 usdIn = (amountIn * price18[fromToken]) / (10 ** f.decimals);
        // Output human amount = usdIn / price_to, then scale to `to` decimals.
        uint256 outHuman = (usdIn * (10 ** t.decimals)) / price18[toToken];
        return outHuman;
    }

    // ---- swap ----
    function swap(address fromToken, address toToken, uint256 amountIn, uint256 minAmountOut)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        TokenInfo storage f = tokens[fromToken];
        TokenInfo storage t = tokens[toToken];
        if (!f.supported) revert NotSupported(fromToken);
        if (!t.supported) revert NotSupported(toToken);
        if (amountIn == 0) revert InsufficientOut(minAmountOut, 0);

        // pull input
        if (f.isNative) {
            require(msg.value == amountIn, "native: msg.value mismatch");
        } else {
            IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn);
        }

        uint256 gross = this.quote(fromToken, toToken, amountIn);
        uint256 fee = (gross * feeBps) / 10000;
        uint256 out = gross - fee;
        if (out < minAmountOut) revert InsufficientOut(minAmountOut, out);

        // ensure vault has inventory
        uint256 inv = t.isNative ? address(this).balance : IERC20(toToken).balanceOf(address(this));
        if (inv < out) revert InsufficientInventory(inv, out);

        _send(toToken, msg.sender, out);
        emit Swap(msg.sender, fromToken, toToken, amountIn, out);
        return out;
    }

    // ---- internal ----
    function _send(address token, address to, uint256 amount) internal {
        TokenInfo storage t = tokens[token];
        if (t.isNative) {
            (bool ok, ) = payable(to).call{ value: amount }("");
            require(ok, "native send failed");
        } else {
            IERC20(token).transfer(to, amount);
        }
    }
}
