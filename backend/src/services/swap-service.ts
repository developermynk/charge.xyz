import { AppKit } from '@circle-fin/app-kit';
import { WalletAdapterFactory } from './wallet-adapter';
import { config } from '../config';
import { WalletConfig, SupportedChain, validateSupportedTokens, validateSupportedChain } from '../types';

const kit = new AppKit();

export interface SwapParams {
  fromChain: SupportedChain;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  walletConfig: WalletConfig;
  slippageBps?: number;
  stopLimit?: string;
  customFee?: { percentageBps: number; recipientAddress: string };
}

export interface SwapEstimateParams {
  fromChain: SupportedChain;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  walletConfig: WalletConfig;
}

export interface SwapResult {
  amountIn: string;
  amountOut: string;
  chain: string;
  txHash: string;
  explorerUrl: string;
  fees: Array<{ type: string; amount: string; token: string }>;
  tokenIn: string;
  tokenOut: string;
  fromAddress: string;
  toAddress: string;
}

export interface SwapEstimate {
  estimatedOutput: string;
  fees: Array<{ type: string; amount: string; token: string }>;
  priceImpact?: string;
  minOutput?: string;
}

export class SwapService {
  static async estimateSwap(params: SwapEstimateParams): Promise<SwapEstimate> {
    const adapter = WalletAdapterFactory.getAdapterForChain(params.fromChain, params.walletConfig);
    const result = await kit.estimateSwap({
      from: { adapter, chain: params.fromChain },
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      config: { kitKey: config.circle.kitKey },
    });
    return {
      estimatedOutput: result.estimatedOutput,
      fees: (result.fees || []).map((f: any) => ({ type: f.type, amount: f.amount, token: f.token })),
      priceImpact: (result as any).priceImpact,
      minOutput: (result as any).minOutput,
    };
  }

  static async executeSwap(params: SwapParams): Promise<SwapResult> {
    const adapter = WalletAdapterFactory.getAdapterForChain(params.fromChain, params.walletConfig);
    const swapConfig: any = { kitKey: config.circle.kitKey };
    if (params.slippageBps !== undefined) swapConfig.slippageBps = params.slippageBps;
    if (params.stopLimit) swapConfig.stopLimit = params.stopLimit;
    if (params.customFee) swapConfig.customFee = params.customFee;

    const result = await kit.swap({
      from: { adapter, chain: params.fromChain },
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      config: swapConfig,
    });

    return {
      amountIn: result.amountIn,
      amountOut: result.amountOut,
      chain: result.chain,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      fees: (result.fees || []).map((f: any) => ({ type: f.type, amount: f.amount, token: f.token })),
      tokenIn: result.tokenIn,
      tokenOut: result.tokenOut,
      fromAddress: result.fromAddress,
      toAddress: result.toAddress,
    };
  }

  static async swapWithRetry(
    params: SwapParams,
    maxRetries: number = 3,
    retryDelayMs: number = 1000
  ): Promise<SwapResult> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try { return await this.executeSwap(params); }
      catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelayMs * attempt));
      }
    }
    throw lastError || new Error('Swap failed after retries');
  }

  static validateSwapParams(params: SwapParams): void {
    if (!params.fromChain) throw new Error('fromChain is required');
    if (!params.tokenIn || !params.tokenOut) throw new Error('tokenIn and tokenOut required');
    if (params.tokenIn === params.tokenOut) throw new Error('tokenIn and tokenOut must differ');
    if (!params.amountIn || parseFloat(params.amountIn) <= 0) throw new Error('amountIn must be positive');
    if (!params.walletConfig) throw new Error('walletConfig is required');
    if (params.slippageBps !== undefined && (params.slippageBps < 0 || params.slippageBps > 10000))
      throw new Error('slippageBps must be 0-10000');
    if (params.stopLimit && parseFloat(params.stopLimit) <= 0) throw new Error('stopLimit must be positive');
    if (params.customFee) {
      if (params.customFee.percentageBps < 0 || params.customFee.percentageBps > 10000)
        throw new Error('customFee.percentageBps must be 0-10000');
      if (!/^0x[a-fA-F0-9]{40}$/.test(params.customFee.recipientAddress))
        throw new Error('customFee.recipientAddress must be valid Ethereum address');
    }
  }
}

export { validateSupportedTokens, validateSupportedChain };