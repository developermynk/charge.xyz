import { AppKit } from '@circle-fin/app-kit';
import { WalletConfig, SupportedChain, ChainInfo, getChainInfo, getChainsByType, getDefaultChain } from '../types';

const kit = new AppKit();

export interface BridgeParams {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  fromWalletConfig: WalletConfig;
  toWalletConfig: WalletConfig;
  useForwarder?: boolean;
  transferSpeed?: 'FAST' | 'STANDARD';
  recipientAddress?: string;
}

export interface BridgeResult {
  amount: string;
  token: string;
  state: 'success' | 'error' | 'pending';
  provider: string;
  config: { transferSpeed: string };
  source: {
    address: string;
    chain: { type: string; chain: string; chainId: number; name: string };
  };
  destination: {
    address: string;
    chain: { type: string; chain: string; chainId: number; name: string };
  };
  steps: Array<{
    name: string;
    state: string;
    txHash?: string;
    explorerUrl?: string;
    data?: { attestation?: string };
    error?: string;
  }>;
}

export interface BridgeEvent {
  action: string;
  values: { txHash?: string; state?: string; data?: { attestation?: string }; error?: string };
}

export interface ChainRouteInfo {
  from: ChainInfo;
  to: ChainInfo[];
}

export class BridgeService {
  static async executeBridge(params: BridgeParams): Promise<BridgeResult> {
    const { fromAdapter, toAdapter } = await import('./wallet-adapter').then(m => 
      m.WalletAdapterFactory.getAdapterForBridge(
        params.fromChain, params.toChain, params.fromWalletConfig, params.toWalletConfig
      )
    );

    const toConfig: any = { adapter: toAdapter, chain: params.toChain, useForwarder: params.useForwarder ?? true };
    if (params.recipientAddress) { toConfig.recipientAddress = params.recipientAddress; delete toConfig.adapter; }

    const result = await kit.bridge({
      from: { adapter: fromAdapter, chain: params.fromChain },
      to: toConfig,
      amount: params.amount,
    });
    return result as BridgeResult;
  }

  static async retryBridge(failedResult: BridgeResult, fromWalletConfig: WalletConfig, toWalletConfig: WalletConfig): Promise<BridgeResult> {
    const { fromAdapter, toAdapter } = await import('./wallet-adapter').then(m =>
      m.WalletAdapterFactory.getAdapterForBridge(
        failedResult.source.chain.chain as SupportedChain,
        failedResult.destination.chain.chain as SupportedChain,
        fromWalletConfig, toWalletConfig
      )
    );
    const retryResult = await kit.retry(failedResult as any, { from: fromAdapter, to: toAdapter });
    return retryResult as BridgeResult;
  }

  static analyzeBridgeResult(result: BridgeResult) {
    const completedSteps = result.steps.filter(s => s.state === 'success').map(s => s.name);
    const failedStep = result.steps.find(s => s.state === 'error');
    return {
      success: result.state === 'success',
      failedStep: failedStep?.name,
      completedSteps,
      errorMessage: failedStep?.error,
    };
  }

  static validateBridgeParams(params: BridgeParams): void {
    if (!params.fromChain || !params.toChain) throw new Error('fromChain and toChain required');
    if (params.fromChain === params.toChain) throw new Error('fromChain and toChain must differ');
    if (!params.amount || parseFloat(params.amount) <= 0) throw new Error('amount must be positive');
    if (!params.fromWalletConfig || !params.toWalletConfig) throw new Error('Wallet configs required');
    if (params.recipientAddress && !/^0x[a-fA-F0-9]{40}$/.test(params.recipientAddress))
      throw new Error('Invalid recipientAddress');
  }

  static getSupportedRoutes(): Array<{ from: SupportedChain; to: SupportedChain[] }> {
    const evm: SupportedChain[] = [
      'Arbitrum','Avalanche','Base','Ethereum','Optimism','Polygon',
      'Arc_Testnet','Arbitrum_Sepolia','Avalanche_Fuji','Base_Sepolia',
      'Ethereum_Sepolia','Optimism_Sepolia','Polygon_Amoy'
    ];
    const solana: SupportedChain[] = ['Solana','Solana_Devnet'];
    const routes: Array<{ from: SupportedChain; to: SupportedChain[] }> = [];
    evm.forEach(f => routes.push({ from: f, to: evm.filter(t => t !== f) }));
    evm.forEach(f => routes.push({ from: f, to: solana }));
    solana.forEach(f => routes.push({ from: f, to: evm }));
    solana.forEach(f => routes.push({ from: f, to: solana.filter(t => t !== f) }));
    return routes;
  }

  static getChainInfo(chain: SupportedChain): ChainInfo {
    return getChainInfo(chain);
  }

  static getAllChainsInfo(): ChainInfo[] {
    return Object.values(getChainInfo('Arc_Testnet') as any).constructor === Array 
      ? [] 
      : Object.values(require('../types').CHAINS_INFO);
  }

  static getChainsByType(type: 'evm' | 'solana'): ChainInfo[] {
    return getChainsByType(type);
  }

  static getChainsByNetwork(network: 'mainnet' | 'testnet'): ChainInfo[] {
    const { getChainsByNetwork } = require('../types');
    return getChainsByNetwork(network);
  }

  static getDefaultChain(): ChainInfo {
    return getDefaultChain();
  }

  static getBridgeRoutesWithInfo(): ChainRouteInfo[] {
    const routes = this.getSupportedRoutes();
    return routes.map(route => ({
      from: getChainInfo(route.from),
      to: route.to.map(getChainInfo),
    }));
  }

  static isTestnet(chain: SupportedChain): boolean {
    return getChainInfo(chain).network === 'testnet';
  }

  static isMainnet(chain: SupportedChain): boolean {
    return getChainInfo(chain).network === 'mainnet';
  }

  static getFaucetUrl(chain: SupportedChain): string | undefined {
    return getChainInfo(chain).faucetUrl;
  }
}