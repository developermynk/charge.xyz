/**
 * On-chain AMM swap path for Arc Testnet.
 *
 * Circle's Stablecoin Service aggregator currently has no seeded swap liquidity
 * on Arc Testnet, so `kit.swap` returns "No route available". Arc Testnet does
 * however have a live Uniswap V2 deployment (per Circle arc-node#160) with real
 * USDC/EURC reserves. This module routes Arc Testnet swaps directly through that
 * router via the user's wallet — no Circle key required, the user signs.
 *
 * Mainnets keep using Circle App Kit (`swap.ts`). This is only for chains where
 * `usesAmmSwap()` is true (currently Arc Testnet).
 */
import {
  type Address,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  getContract,
  http,
  maxUint256,
  parseUnits,
} from "viem";
import {
  ARC_AMM_ROUTER_ABI,
  ARC_SWAP_VAULT,
  ARC_SWAP_VAULT_ABI,
  ARC_TESTNET_AMM,
  EVM_CHAIN_BY_SDK_ID,
  TOKEN_REGISTRY,
} from "@charge/chains";

const ROUTER_ABI = ARC_AMM_ROUTER_ABI;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export interface AmmSwapRequest {
  provider: EIP1193Provider;
  address: Address;
  chain: string; // "Arc_Testnet"
  tokenIn: string; // symbol, resolved via TOKEN_REGISTRY
  tokenOut: string;
  /** Optional ERC-20 address override (launched/custom tokens). */
  tokenInAddress?: `0x${string}`;
  tokenOutAddress?: `0x${string}`;
  /** Decimals for an address override (read on-chain by the caller). */
  tokenInDecimals?: number;
  tokenOutDecimals?: number;
  amountIn: string; // decimal string
  slippageBps?: number;
}

export function tokenMeta(
  chain: string,
  symbol: string,
  override?: `0x${string}`,
  decimalsOverride?: number,
): { address: Address; decimals: number } {
  if (override) {
    const reg = TOKEN_REGISTRY[chain]?.[symbol];
    return {
      address: getAddress(override),
      decimals: decimalsOverride ?? reg?.decimals ?? 18,
    };
  }
  const reg = TOKEN_REGISTRY[chain];
  const entry = reg?.[symbol];
  if (!entry?.address) {
    throw new Error(`No token address for ${symbol} on ${chain}`);
  }
  return { address: getAddress(entry.address), decimals: entry.decimals ?? 18 };
}

export function publicClientFor(chain: string): PublicClient {
  const def = EVM_CHAIN_BY_SDK_ID.get(chain);
  if (!def) throw new Error(`Unknown chain ${chain}`);
  return createPublicClient({
    chain: {
      id: def.chainId,
      name: def.name,
      nativeCurrency: { name: def.nativeSymbol, symbol: def.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [def.rpcUrl] } },
    },
    transport: http(),
  }) as PublicClient;
}

/**
 * Poll `eth_getTransactionReceipt` directly instead of viem's
 * `waitForTransactionReceipt`. Arc's RPC returns a malformed/empty transaction
 * hash on some receipts, which makes viem's receipt-enrichment call
 * `eth_getTransactionByHash("0")` and throw "Invalid params". Polling the
 * receipt alone never triggers that enrichment, so swaps confirm cleanly.
 */
export async function waitReceipt(
  pc: PublicClient,
  hash: string,
  timeoutMs = 90_000,
): Promise<{ status: string; hash: string; transactionHash?: string }> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = (await pc
      .getTransactionReceipt({ hash: hash as `0x${string}` })
      .catch(() => null)) as { status?: string; transactionHash?: string } | null;
    if (r) {
      return {
        status: r.status ?? "unknown",
        hash,
        transactionHash: r.transactionHash,
      };
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Receipt not found within timeout");
    }
    await new Promise((res) => setTimeout(res, 2_000));
  }
}

export function walletClientFor(provider: EIP1193Provider, chain: string): WalletClient {
  const def = EVM_CHAIN_BY_SDK_ID.get(chain);
  if (!def) throw new Error(`Unknown chain ${chain}`);
  return createWalletClient({
    chain: {
      id: def.chainId,
      name: def.name,
      nativeCurrency: { name: def.nativeSymbol, symbol: def.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [def.rpcUrl] } },
    },
    transport: custom(provider),
  }) as WalletClient;
}

export async function quoteAmmSwap(req: AmmSwapRequest): Promise<{
  estimatedOutput: string;
  rate: string;
  tokenOut: string;
}> {
  const { address: tokenIn, decimals } = tokenMeta(
    req.chain,
    req.tokenIn,
    req.tokenInAddress,
    req.tokenInDecimals,
  );
  const { address: tokenOut } = tokenMeta(
    req.chain,
    req.tokenOut,
    req.tokenOutAddress,
    req.tokenOutDecimals,
  );
  if (tokenIn === tokenOut) throw new Error("Cannot swap a token for itself.");

  const pc = publicClientFor(req.chain);
  const amountIn = parseUnits(req.amountIn, decimals);

  const router = getContract({
    address: ARC_TESTNET_AMM.router as Address,
    abi: ROUTER_ABI,
    client: pc,
  });
  const amounts = (await router.read.getAmountsOut([amountIn, [tokenIn, tokenOut]])) as bigint[];
  const out = amounts[amounts.length - 1]!;

  const inNum = Number(req.amountIn);
  const outNum = Number(out) / 10 ** decimals;
  return {
    // Decimal string (matches Circle's SwapEstimate.estimatedOutput shape) so
    // the "You receive" box renders 0.352104, not the raw wei integer.
    estimatedOutput: outNum.toString(),
    rate: inNum > 0 ? (outNum / inNum).toFixed(6) : "0",
    tokenOut: req.tokenOut,
  };
}

export async function executeAmmSwap(req: AmmSwapRequest): Promise<{
  txHash: string;
  amountOut?: string;
}> {
  const { address: tokenIn, decimals } = tokenMeta(
    req.chain,
    req.tokenIn,
    req.tokenInAddress,
    req.tokenInDecimals,
  );
  const { address: tokenOut } = tokenMeta(
    req.chain,
    req.tokenOut,
    req.tokenOutAddress,
    req.tokenOutDecimals,
  );
  if (tokenIn === tokenOut) throw new Error("Cannot swap a token for itself.");

  const pc = publicClientFor(req.chain);
  const wc = walletClientFor(req.provider, req.chain);

  const amountIn = parseUnits(req.amountIn, decimals);

  // Quote min out with slippage.
  const router = getContract({
    address: ARC_TESTNET_AMM.router as Address,
    abi: ROUTER_ABI,
    client: pc,
  });
  const amounts = (await router.read.getAmountsOut([amountIn, [tokenIn, tokenOut]])) as bigint[];
  const expected = amounts[amounts.length - 1]!;
  const slippage = req.slippageBps ?? 50;
  const minOut = (expected * BigInt(10000 - slippage)) / 10000n;

  // Ensure allowance.
  const allowance = (await pc.readContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [req.address, ARC_TESTNET_AMM.router as Address],
  })) as bigint;
  if (allowance < amountIn) {
    const [approveHash] = (await wc.writeContract({
      address: tokenIn,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ARC_TESTNET_AMM.router as Address, maxUint256],
      account: req.address,
    } as never)) as unknown as [string];
    await waitReceipt(pc, approveHash);
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const raw = (await wc.writeContract({
    address: ARC_TESTNET_AMM.router as Address,
    abi: ROUTER_ABI,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, minOut, [tokenIn, tokenOut], req.address, deadline],
    account: req.address,
  } as never)) as string | [string];
  // viem's walletClient.writeContract returns the tx hash directly (string),
  // not a tuple — handle both shapes so we never emit an invalid hash.
  const swapHash = Array.isArray(raw) ? raw[0] : raw;
  // Confirmation is best-effort: if the receipt can't be fetched (Arc RPC
  // quirk / provider oddity), still return the hash we have so the UI can show
  // the transaction link instead of failing the whole swap.
  let receipt: { transactionHash?: string } = {};
  try {
    receipt = await waitReceipt(pc, swapHash);
  } catch {
    /* non-fatal — fall back to writeContract hash below */
  }
  // Arc reliably populates receipt.transactionHash; Privy's email wallet can
  // return an empty/odd value from writeContract, so prefer the confirmed
  // receipt hash and fall back to writeContract's return.
  const finalHash =
    (receipt.transactionHash &&
    receipt.transactionHash.startsWith("0x") &&
    receipt.transactionHash !== "0x0"
      ? receipt.transactionHash
      : swapHash) || swapHash;
  console.debug("[amm-swap] writeContract=", swapHash, "receipt=", receipt.transactionHash, "final=", finalHash);

  return { txHash: finalHash };
}

/**
 * Inventory-vault swap path for Arc Testnet (USDC/EURC/cirBTC).
 *
 * The local AMM has no cirBTC pool and Circle's aggregator has no Arc liquidity,
 * so these pairs route through Charge's `ArcSwapMulti` vault, which holds the
 * inventory and quotes via owner-set USD prices. The user signs the approval +
 * swap; the vault pulls `from` and sends `to` atomically.
 */
export type VaultSwapRequest = AmmSwapRequest;

export async function quoteVaultSwap(req: VaultSwapRequest): Promise<{
  estimatedOutput: string;
  rate: string;
  tokenOut: string;
}> {
  const { address: tokenIn, decimals: decIn } = tokenMeta(
    req.chain,
    req.tokenIn,
    req.tokenInAddress,
    req.tokenInDecimals,
  );
  const { address: tokenOut, decimals: decOut } = tokenMeta(
    req.chain,
    req.tokenOut,
    req.tokenOutAddress,
    req.tokenOutDecimals,
  );
  if (tokenIn === tokenOut) throw new Error("Cannot swap a token for itself.");

  const pc = publicClientFor(req.chain);
  const amountIn = parseUnits(req.amountIn, decIn);

  const vault = getContract({
    address: ARC_SWAP_VAULT as Address,
    abi: ARC_SWAP_VAULT_ABI,
    client: pc,
  });
  const out = (await vault.read.quote([tokenIn, tokenOut, amountIn])) as bigint;
  const feeBps = (await vault.read.feeBps()) as bigint;
  const outAfterFee = (out * (10000n - feeBps)) / 10000n;

  // Guard: the vault must actually hold enough of the output token to pay out.
  // If it doesn't, the on-chain swap reverts with a cryptic
  // "ERC20: transfer amount exceeds balance" — surface it clearly up front.
  const inv = (await vault.read.vaultBalance([tokenOut])) as bigint;
  if (outAfterFee > inv) {
    const have = (Number(inv) / 10 ** decOut).toFixed(decOut > 6 ? 8 : 4);
    const want = (Number(outAfterFee) / 10 ** decOut).toFixed(decOut > 6 ? 8 : 4);
    throw new Error(
      `Vault has insufficient ${req.tokenOut} liquidity (has ${have}, this swap needs ${want}). Try a smaller amount or top up the vault.`,
    );
  }

  const inNum = Number(req.amountIn);
  const outNum = Number(outAfterFee) / 10 ** decOut;
  return {
    estimatedOutput: outNum.toString(),
    rate: inNum > 0 ? (outNum / inNum).toFixed(6) : "0",
    tokenOut: req.tokenOut,
  };
}

export async function executeVaultSwap(req: VaultSwapRequest): Promise<{
  txHash: string;
  amountOut?: string;
}> {
  const { address: tokenIn, decimals: decIn } = tokenMeta(
    req.chain,
    req.tokenIn,
    req.tokenInAddress,
    req.tokenInDecimals,
  );
  const { address: tokenOut, decimals: decOut } = tokenMeta(
    req.chain,
    req.tokenOut,
    req.tokenOutAddress,
    req.tokenOutDecimals,
  );
  if (tokenIn === tokenOut) throw new Error("Cannot swap a token for itself.");

  const pc = publicClientFor(req.chain);
  const wc = walletClientFor(req.provider, req.chain);

  const amountIn = parseUnits(req.amountIn, decIn);
  const vaultAddr = ARC_SWAP_VAULT as Address;

  const vault = getContract({ address: vaultAddr, abi: ARC_SWAP_VAULT_ABI, client: pc });
  const expected = (await vault.read.quote([tokenIn, tokenOut, amountIn])) as bigint;
  const feeBps = (await vault.read.feeBps()) as bigint;
  // The vault deducts its fee from the quoted (gross) amount to get the actual
  // output, so the user's slippage tolerance must be applied to the POST-fee
  // amount — otherwise minOut can exceed the real output and the tx reverts.
  const outAfterFee = (expected * (10000n - feeBps)) / 10000n;
  const slippage = req.slippageBps ?? 50;
  const minOut = (outAfterFee * BigInt(10000 - slippage)) / 10000n;

  // Guard: reject up front if the vault can't cover the output, instead of
  // letting the on-chain call revert with a cryptic ERC20 balance error.
  const inv = (await vault.read.vaultBalance([tokenOut])) as bigint;
  if (outAfterFee > inv) {
    const have = (Number(inv) / 10 ** decOut).toFixed(decOut > 6 ? 8 : 4);
    const want = (Number(outAfterFee) / 10 ** decOut).toFixed(decOut > 6 ? 8 : 4);
    throw new Error(
      `Vault has insufficient ${req.tokenOut} liquidity (has ${have}, this swap needs ${want}). Try a smaller amount or top up the vault.`,
    );
  }

  // Ensure the vault can pull the input token.
  const allowance = (await pc.readContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [req.address, vaultAddr],
  })) as bigint;
  if (allowance < amountIn) {
    const [approveHash] = (await wc.writeContract({
      address: tokenIn,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddr, maxUint256],
      account: req.address,
    } as never)) as unknown as [string];
    await waitReceipt(pc, approveHash);
  }

  const raw = (await wc.writeContract({
    address: vaultAddr,
    abi: ARC_SWAP_VAULT_ABI,
    functionName: "swap",
    args: [tokenIn, tokenOut, amountIn, minOut],
    account: req.address,
  } as never)) as string | [string];
  const swapHash = Array.isArray(raw) ? raw[0] : raw;
  // Confirmation is best-effort: if the receipt can't be fetched (Arc RPC
  // quirk / provider oddity), still return the hash we have so the UI can show
  // the transaction link instead of failing the whole swap.
  let receipt: { transactionHash?: string } = {};
  try {
    receipt = await waitReceipt(pc, swapHash);
  } catch {
    /* non-fatal — fall back to writeContract hash below */
  }
  // Arc reliably populates receipt.transactionHash; Privy's email wallet can
  // return an empty/odd value from writeContract, so prefer the confirmed
  // receipt hash and fall back to writeContract's return.
  const finalHash =
    (receipt.transactionHash &&
    receipt.transactionHash.startsWith("0x") &&
    receipt.transactionHash !== "0x0"
      ? receipt.transactionHash
      : swapHash) || swapHash;
  console.debug("[vault-swap] writeContract=", swapHash, "receipt=", receipt.transactionHash, "final=", finalHash);

  return { txHash: finalHash, amountOut: (Number(expected) / 10 ** decOut).toString() };
}
