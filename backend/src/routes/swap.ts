import { Router, Request, Response } from 'express';
import { AppKit } from '@circle-fin/app-kit';
import { createViemAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';
import { config } from '../config';

const kit = new AppKit();

interface SwapEstimateRequest {
  fromChain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  walletType: 'private_key' | 'circle_wallet';
  privateKey?: string;
  walletAddress?: string;
  circleApiKey?: string;
  circleEntitySecret?: string;
}

interface SwapExecuteRequest extends SwapEstimateRequest {
  slippageBps?: number;
  stopLimit?: string;
  customFee?: {
    percentageBps: number;
    recipientAddress: string;
  };
}

function createAdapter(walletType: string, req: any) {
  if (walletType === 'private_key') {
    const privateKey = req.privateKey || config.wallet.evmPrivateKey;
    if (!privateKey || !privateKey.startsWith('0x')) {
      throw new Error('Private key is required and must be 0x-prefixed');
    }
    return createViemAdapterFromPrivateKey({ privateKey: privateKey as `0x${string}` });
  } else if (walletType === 'circle_wallet') {
    const apiKey = req.circleApiKey || config.circle.apiKey;
    const entitySecret = req.circleEntitySecret || config.circle.entitySecret;
    if (!apiKey || !entitySecret) {
      throw new Error('Circle API key and entity secret are required');
    }
    return createCircleWalletsAdapter({ apiKey, entitySecret });
  }
  throw new Error('Invalid wallet type');
}

const router = Router();

router.post('/estimate', async (req: Request, res: Response) => {
  try {
    const body = req.body as SwapEstimateRequest;
    const { fromChain, tokenIn, tokenOut, amountIn, walletType } = body;

    if (!fromChain || !tokenIn || !tokenOut || !amountIn || !walletType) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
      });
    }

    const adapter = createAdapter(walletType, body);

    const fromConfig: any = { adapter, chain: fromChain };
    if (walletType === 'circle_wallet' && body.walletAddress) {
      fromConfig.address = body.walletAddress;
    } else if (walletType === 'circle_wallet' && config.wallet.evmWalletAddress) {
      fromConfig.address = config.wallet.evmWalletAddress;
    }

    const estimate = await kit.estimateSwap({
      from: fromConfig,
      tokenIn,
      tokenOut,
      amountIn,
      config: { kitKey: config.circle.kitKey },
    });

    res.json({
      success: true,
      data: {
        estimatedOutput: estimate.estimatedOutput,
        fees: estimate.fees || [],
        priceImpact: estimate.priceImpact,
        minOutput: estimate.minOutput,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'ESTIMATE_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const body = req.body as SwapExecuteRequest;
    const { fromChain, tokenIn, tokenOut, amountIn, walletType, slippageBps, stopLimit, customFee } = body;

    if (!fromChain || !tokenIn || !tokenOut || !amountIn || !walletType) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
      });
    }

    const adapter = createAdapter(walletType, body);

    const fromConfig: any = { adapter, chain: fromChain };
    if (walletType === 'circle_wallet' && body.walletAddress) {
      fromConfig.address = body.walletAddress;
    } else if (walletType === 'circle_wallet' && config.wallet.evmWalletAddress) {
      fromConfig.address = config.wallet.evmWalletAddress;
    }

    const swapConfig: any = { kitKey: config.circle.kitKey };
    if (slippageBps !== undefined) swapConfig.slippageBps = slippageBps;
    if (stopLimit) swapConfig.stopLimit = stopLimit;
    if (customFee) swapConfig.customFee = customFee;

    const result = await kit.swap({
      from: fromConfig,
      tokenIn,
      tokenOut,
      amountIn,
      config: swapConfig,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'SWAP_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

router.get('/supported-tokens', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { supportedTokens: ['USDC', 'EURC', 'USDT', 'PYUSD', 'DAI', 'USDE', 'WBTC', 'WETH', 'WSOL', 'WAVAX', 'WPOL', 'NATIVE'] },
  });
});

router.get('/supported-chains', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { supportedChains: ['Ethereum', 'Base', 'Arbitrum', 'Optimism', 'Polygon', 'Avalanche', 'Solana', 'Arc_Testnet', 'Ethereum_Sepolia', 'Base_Sepolia', 'Arbitrum_Sepolia', 'Polygon_Amoy', 'Solana_Devnet'] },
  });
});

export default router;