import { createViemAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';
import { createSolanaKitAdapterFromPrivateKey } from '@circle-fin/adapter-solana-kit';
import { config } from '../config';
import { WalletConfig, SupportedChain } from '../types';

export class WalletAdapterFactory {
  private static viemAdapter: any = null;
  private static circleWalletsAdapter: any = null;
  private static solanaAdapter: any = null;

  static createViemAdapter(privateKey?: string): any {
    const key = privateKey || config.wallet.evmPrivateKey;
    if (!key || !key.startsWith('0x')) throw new Error('Private key must be set and 0x-prefixed');
    if (this.viemAdapter) return this.viemAdapter;
    this.viemAdapter = createViemAdapterFromPrivateKey({ privateKey: key as `0x${string}` });
    return this.viemAdapter;
  }

  static createCircleWalletsAdapter(apiKey?: string, entitySecret?: string): any {
    const key = apiKey || config.circle.apiKey;
    const secret = entitySecret || config.circle.entitySecret;
    if (!key || !secret) throw new Error('CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set');
    if (this.circleWalletsAdapter) return this.circleWalletsAdapter;
    this.circleWalletsAdapter = createCircleWalletsAdapter({ apiKey: key, entitySecret: secret });
    return this.circleWalletsAdapter;
  }

  static createSolanaAdapter(privateKey?: string): any {
    const key = privateKey || config.wallet.solanaPrivateKey;
    if (!key || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(key)) throw new Error('Solana private key must be base58-encoded');
    if (this.solanaAdapter) return this.solanaAdapter;
    this.solanaAdapter = createSolanaKitAdapterFromPrivateKey({ privateKey: key });
    return this.solanaAdapter;
  }

  static getAdapterForChain(chain: SupportedChain, walletConfig: WalletConfig): any {
    const isEvm = !['Solana', 'Solana_Devnet'].includes(chain);
    const isSolana = ['Solana', 'Solana_Devnet'].includes(chain);

    if (isEvm) {
      if (walletConfig.type === 'private_key') return this.createViemAdapter(walletConfig.privateKey);
      if (walletConfig.type === 'circle_wallet') return this.createCircleWalletsAdapter(walletConfig.circleApiKey, walletConfig.circleEntitySecret);
      throw new Error(`Unsupported wallet type: ${walletConfig.type}`);
    }

    if (isSolana) {
      if (walletConfig.type !== 'private_key') throw new Error('Solana only supports private_key wallet type');
      return this.createSolanaAdapter(walletConfig.privateKey);
    }

    throw new Error(`Unsupported chain: ${chain}`);
  }

  static getAdapterForBridge(
    fromChain: SupportedChain,
    toChain: SupportedChain,
    fromWalletConfig: WalletConfig,
    toWalletConfig: WalletConfig
  ): { fromAdapter: any; toAdapter: any } {
    return {
      fromAdapter: this.getAdapterForChain(fromChain, fromWalletConfig),
      toAdapter: this.getAdapterForChain(toChain, toWalletConfig),
    };
  }

  static reset(): void {
    this.viemAdapter = null;
    this.circleWalletsAdapter = null;
    this.solanaAdapter = null;
  }
}

export function createWalletConfig(
  type: WalletConfig['type'],
  options: Partial<WalletConfig> = {}
): WalletConfig {
  return { type, ...options } as WalletConfig;
}