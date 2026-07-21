import { Router, Request, Response } from 'express';
import { AppKit } from '@circle-fin/app-kit';
import { createViemAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';
import { createSolanaKitAdapterFromPrivateKey } from '@circle-fin/adapter-solana-kit';
import { config } from '../config';
import { SupportedChain, ChainInfo, getChainInfo, getChainsByNetwork, getChainsByType, getDefaultChain, CHAINS_INFO } from '../types';

const kit = new AppKit();

interface BridgeExecuteRequest {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  fromWalletType: 'private_key' | 'circle_wallet' | 'solana_private_key';
  toWalletType: 'private_key' | 'circle_wallet' | 'solana_private_key';
  fromPrivateKey?: string;
  toPrivateKey?: string;
  fromWalletAddress?: string;
  toWalletAddress?: string;
  fromCircleApiKey?: string;
  fromCircleEntitySecret?: string;
  toCircleApiKey?: string;
  toCircleEntitySecret?: string;
  useForwarder?: boolean;
  transferSpeed?: 'FAST' | 'STANDARD';
  recipientAddress?: string;
}

function createAdapter(walletType: string, req: any, isFrom: boolean) {
  const prefix = isFrom ? 'from' : 'to';
  
  if (walletType === 'private_key') {
    const privateKey = req[`${prefix}PrivateKey`] || (isFrom ? config.wallet.evmPrivateKey : config.wallet.evmPrivateKey);
    if (!privateKey || !privateKey.startsWith('0x')) {
      throw new Error(`${prefix} private key is required and must be 0x-prefixed`);
    }
    return createViemAdapterFromPrivateKey({ privateKey: privateKey as `0x${string}` });
  } else if (walletType === 'circle_wallet') {
    const apiKey = req[`${prefix}CircleApiKey`] || config.circle.apiKey;
    const entitySecret = req[`${prefix}CircleEntitySecret`] || config.circle.entitySecret;
    const address = req[`${prefix}WalletAddress`] || config.wallet.evmWalletAddress;
    if (!apiKey || !entitySecret) {
      throw new Error(`${prefix} Circle API key and entity secret are required`);
    }
    if (!address) {
      throw new Error(`${prefix} wallet address is required for circle_wallet type`);
    }
    return createCircleWalletsAdapter({ apiKey, entitySecret });
  } else if (walletType === 'solana_private_key') {
    const privateKey = req[`${prefix}PrivateKey`] || config.wallet.solanaPrivateKey;
    if (!privateKey || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(privateKey)) {
      throw new Error(`${prefix} Solana private key is required and must be base58-encoded`);
    }
    return createSolanaKitAdapterFromPrivateKey({ privateKey });
  }
  throw new Error(`Invalid wallet type: ${walletType}`);
}

const router = Router();

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const body = req.body as BridgeExecuteRequest;
    const { 
      fromChain, 
      toChain, 
      amount, 
      fromWalletType, 
      toWalletType,
      useForwarder = true,
      transferSpeed = 'FAST',
      recipientAddress,
    } = body;

    if (!fromChain || !toChain || !amount || !fromWalletType || !toWalletType) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
      });
    }

    if (fromChain === toChain) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'fromChain and toChain must be different' },
      });
    }

    const fromAdapter = createAdapter(fromWalletType, body, true);
    const toAdapter = createAdapter(toWalletType, body, false);

    const fromConfig: any = { adapter: fromAdapter, chain: fromChain };
    if (fromWalletType === 'circle_wallet') {
      const fromAddress = body.fromWalletAddress || config.wallet.evmWalletAddress;
      if (fromAddress) fromConfig.address = fromAddress;
    }

    const toConfig: any = {
      adapter: toAdapter,
      chain: toChain,
      useForwarder,
    };
    
    if (toWalletType === 'circle_wallet') {
      const toAddress = body.toWalletAddress || config.wallet.evmWalletAddress;
      if (toAddress) toConfig.address = toAddress;
    }

    if (recipientAddress) {
      toConfig.recipientAddress = recipientAddress;
      delete toConfig.adapter;
    }

    const result = await kit.bridge({
      from: fromConfig,
      to: toConfig,
      amount,
    });

    const analysis = analyzeBridgeResult(result);

    res.json({
      success: true,
      data: { result, analysis },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'BRIDGE_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

router.post('/retry', async (req: Request, res: Response) => {
  try {
    const { failedResult, fromWalletType, toWalletType } = req.body;

    if (!failedResult || !fromWalletType || !toWalletType) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'failedResult, fromWalletType, toWalletType required' },
      });
    }

    const fromAdapter = createAdapter(fromWalletType, req.body, true);
    const toAdapter = createAdapter(toWalletType, req.body, false);

    const retryResult = await kit.retry(failedResult, { from: fromAdapter, to: toAdapter });
    const analysis = analyzeBridgeResult(retryResult);

    res.json({ success: true, data: { result: retryResult, analysis } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'RETRY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
});

router.post('/analyze', (req: Request, res: Response) => {
  try {
    const { result } = req.body;
    if (!result) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'result required' } });
    }
    const analysis = analyzeBridgeResult(result);
    res.json({ success: true, data: { analysis } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

function analyzeBridgeResult(result: any) {
  const completedSteps = result.steps?.filter((s: any) => s.state === 'success').map((s: any) => s.name) || [];
  const failedStep = result.steps?.find((s: any) => s.state === 'error');
  
  return {
    success: result.state === 'success',
    failedStep: failedStep?.name,
    completedSteps,
    errorMessage: failedStep?.error,
  };
}

router.get('/supported-chains', (req: Request, res: Response) => {
  const mainnetChains = getChainsByNetwork('mainnet');
  const testnetChains = getChainsByNetwork('testnet');
  
  res.json({
    success: true,
    data: {
      mainnet: mainnetChains.map(c => ({ 
        chain: c.chain, 
        name: c.name, 
        type: c.type, 
        chainId: c.chainId, 
        explorerUrl: c.explorerUrl,
        nativeCurrency: c.nativeCurrency 
      })),
      testnet: testnetChains.map(c => ({ 
        chain: c.chain, 
        name: c.name, 
        type: c.type, 
        chainId: c.chainId, 
        explorerUrl: c.explorerUrl,
        nativeCurrency: c.nativeCurrency,
        faucetUrl: c.faucetUrl 
      })),
      defaultChain: getDefaultChain(),
    },
  });
});

router.get('/chains/:chain', (req: Request, res: Response) => {
  try {
    const chain = req.params.chain as SupportedChain;
    const chainInfo = getChainInfo(chain);
    res.json({
      success: true,
      data: chainInfo,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: { code: 'CHAIN_NOT_FOUND', message: `Chain ${req.params.chain} not supported` },
    });
  }
});

router.get('/routes', (req: Request, res: Response) => {
  const { BridgeService } = require('../services/bridge-service');
  const routes = BridgeService.getBridgeRoutesWithInfo();
  res.json({
    success: true,
    data: routes,
  });
});

export default router;