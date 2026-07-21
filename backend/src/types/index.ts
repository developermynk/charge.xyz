export type SupportedChain = 
  | 'Arbitrum' | 'Avalanche' | 'Base' | 'Ethereum' | 'HyperEVM'
  | 'Ink' | 'Linea' | 'Monad' | 'Optimism' | 'Plume' | 'Polygon'
  | 'Sei' | 'Solana' | 'Sonic' | 'Unichain' | 'World_Chain' | 'XDC'
  | 'Arc_Testnet' | 'Arbitrum_Sepolia' | 'Avalanche_Fuji' | 'Base_Sepolia'
  | 'Ethereum_Sepolia' | 'Optimism_Sepolia' | 'Polygon_Amoy' | 'Solana_Devnet';

export type ChainType = 'evm' | 'solana';
export type ChainNetwork = 'mainnet' | 'testnet';

export interface ChainInfo {
  chain: SupportedChain;
  name: string;
  type: ChainType;
  network: ChainNetwork;
  chainId: number;
  explorerUrl: string;
  faucetUrl?: string;
  nativeCurrency: string;
  isDefault?: boolean;
}

export const CHAINS_INFO: Record<SupportedChain, ChainInfo> = {
  // Mainnet EVM chains
  Arbitrum: { chain: 'Arbitrum', name: 'Arbitrum', type: 'evm', network: 'mainnet', chainId: 42161, explorerUrl: 'https://arbiscan.io', nativeCurrency: 'ETH' },
  Avalanche: { chain: 'Avalanche', name: 'Avalanche C-Chain', type: 'evm', network: 'mainnet', chainId: 43114, explorerUrl: 'https://snowtrace.io', nativeCurrency: 'AVAX' },
  Base: { chain: 'Base', name: 'Base', type: 'evm', network: 'mainnet', chainId: 8453, explorerUrl: 'https://basescan.org', nativeCurrency: 'ETH' },
  Ethereum: { chain: 'Ethereum', name: 'Ethereum', type: 'evm', network: 'mainnet', chainId: 1, explorerUrl: 'https://etherscan.io', nativeCurrency: 'ETH' },
  HyperEVM: { chain: 'HyperEVM', name: 'HyperEVM', type: 'evm', network: 'mainnet', chainId: 999, explorerUrl: 'https://explorer.hyperliquid.xyz', nativeCurrency: 'HYPE' },
  Ink: { chain: 'Ink', name: 'Ink', type: 'evm', network: 'mainnet', chainId: 57073, explorerUrl: 'https://explorer.inkonchain.com', nativeCurrency: 'ETH' },
  Linea: { chain: 'Linea', name: 'Linea', type: 'evm', network: 'mainnet', chainId: 59144, explorerUrl: 'https://lineascan.build', nativeCurrency: 'ETH' },
  Monad: { chain: 'Monad', name: 'Monad', type: 'evm', network: 'mainnet', chainId: 10143, explorerUrl: 'https://explorer.monad.xyz', nativeCurrency: 'MON' },
  Optimism: { chain: 'Optimism', name: 'Optimism', type: 'evm', network: 'mainnet', chainId: 10, explorerUrl: 'https://optimistic.etherscan.io', nativeCurrency: 'ETH' },
  Plume: { chain: 'Plume', name: 'Plume', type: 'evm', network: 'mainnet', chainId: 161221135, explorerUrl: 'https://explorer.plume.org', nativeCurrency: 'PLUME' },
  Polygon: { chain: 'Polygon', name: 'Polygon', type: 'evm', network: 'mainnet', chainId: 137, explorerUrl: 'https://polygonscan.com', nativeCurrency: 'POL' },
  Sei: { chain: 'Sei', name: 'Sei', type: 'evm', network: 'mainnet', chainId: 1329, explorerUrl: 'https://seitrace.com', nativeCurrency: 'SEI' },
  Sonic: { chain: 'Sonic', name: 'Sonic', type: 'evm', network: 'mainnet', chainId: 146, explorerUrl: 'https://sonicscan.org', nativeCurrency: 'S' },
  Unichain: { chain: 'Unichain', name: 'Unichain', type: 'evm', network: 'mainnet', chainId: 130, explorerUrl: 'https://uniscan.xyz', nativeCurrency: 'ETH' },
  World_Chain: { chain: 'World_Chain', name: 'World Chain', type: 'evm', network: 'mainnet', chainId: 480, explorerUrl: 'https://worldscan.org', nativeCurrency: 'ETH' },
  XDC: { chain: 'XDC', name: 'XDC Network', type: 'evm', network: 'mainnet', chainId: 50, explorerUrl: 'https://xdcscan.org', nativeCurrency: 'XDC' },

  // Testnet EVM chains
  Arc_Testnet: { chain: 'Arc_Testnet', name: 'Arc Testnet', type: 'evm', network: 'testnet', chainId: 5042002, explorerUrl: 'https://testnet-explorer.arc.network', faucetUrl: 'https://faucet.arc.network', nativeCurrency: 'USDC', isDefault: true },
  Arbitrum_Sepolia: { chain: 'Arbitrum_Sepolia', name: 'Arbitrum Sepolia', type: 'evm', network: 'testnet', chainId: 421614, explorerUrl: 'https://sepolia.arbiscan.io', faucetUrl: 'https://faucet.quicknode.com/arbitrum-sepolia', nativeCurrency: 'ETH' },
  Avalanche_Fuji: { chain: 'Avalanche_Fuji', name: 'Avalanche Fuji', type: 'evm', network: 'testnet', chainId: 43113, explorerUrl: 'https://testnet.snowtrace.io', faucetUrl: 'https://faucet.avax.network', nativeCurrency: 'AVAX' },
  Base_Sepolia: { chain: 'Base_Sepolia', name: 'Base Sepolia', type: 'evm', network: 'testnet', chainId: 84532, explorerUrl: 'https://sepolia.basescan.org', faucetUrl: 'https://faucet.quicknode.com/base-sepolia', nativeCurrency: 'ETH' },
  Ethereum_Sepolia: { chain: 'Ethereum_Sepolia', name: 'Ethereum Sepolia', type: 'evm', network: 'testnet', chainId: 11155111, explorerUrl: 'https://sepolia.etherscan.io', faucetUrl: 'https://sepoliafaucet.com', nativeCurrency: 'ETH' },
  Optimism_Sepolia: { chain: 'Optimism_Sepolia', name: 'Optimism Sepolia', type: 'evm', network: 'testnet', chainId: 11155420, explorerUrl: 'https://sepolia-optimism.etherscan.io', faucetUrl: 'https://faucet.quicknode.com/optimism-sepolia', nativeCurrency: 'ETH' },
  Polygon_Amoy: { chain: 'Polygon_Amoy', name: 'Polygon Amoy', type: 'evm', network: 'testnet', chainId: 80002, explorerUrl: 'https://amoy.polygonscan.com', faucetUrl: 'https://faucet.polygon.technology', nativeCurrency: 'POL' },

  // Solana chains
  Solana: { chain: 'Solana', name: 'Solana Mainnet', type: 'solana', network: 'mainnet', chainId: 101, explorerUrl: 'https://explorer.solana.com', nativeCurrency: 'SOL' },
  Solana_Devnet: { chain: 'Solana_Devnet', name: 'Solana Devnet', type: 'solana', network: 'testnet', chainId: 101, explorerUrl: 'https://explorer.solana.com/?cluster=devnet', faucetUrl: 'https://faucet.solana.com', nativeCurrency: 'SOL' },
};

export const DEFAULT_CHAIN: SupportedChain = 'Arc_Testnet';

export function getChainInfo(chain: SupportedChain): ChainInfo {
  return CHAINS_INFO[chain];
}

export function getChainsByNetwork(network: ChainNetwork): ChainInfo[] {
  return Object.values(CHAINS_INFO).filter(c => c.network === network);
}

export function getChainsByType(type: ChainType): ChainInfo[] {
  return Object.values(CHAINS_INFO).filter(c => c.type === type);
}

export function getDefaultChain(): ChainInfo {
  return CHAINS_INFO[DEFAULT_CHAIN];
}

export type SupportedToken = 
  | 'USDC' | 'EURC' | 'USDT' | 'PYUSD' | 'DAI' | 'USDE'
  | 'WBTC' | 'WETH' | 'WSOL' | 'WAVAX' | 'WPOL' | 'NATIVE';

export type WalletType = 'private_key' | 'circle_wallet';

export interface WalletConfig {
  type: WalletType;
  privateKey?: string;
  address?: string;
  circleApiKey?: string;
  circleEntitySecret?: string;
}

export interface SwapRequest {
  fromChain: SupportedChain;
  tokenIn: SupportedToken;
  tokenOut: SupportedToken;
  amountIn: string;
  walletConfig: WalletConfig;
  slippageBps?: number;
  stopLimit?: string;
  customFee?: {
    percentageBps: number;
    recipientAddress: string;
  };
}

export interface SwapEstimateRequest {
  fromChain: SupportedChain;
  tokenIn: SupportedToken;
  tokenOut: SupportedToken;
  amountIn: string;
  walletConfig: WalletConfig;
}

export interface SwapResponse {
  amountIn: string;
  amountOut: string;
  chain: string;
  txHash: string;
  explorerUrl: string;
  fees: Array<{
    type: string;
    amount: string;
    token: string;
  }>;
  tokenIn: string;
  tokenOut: string;
  fromAddress: string;
  toAddress: string;
}

export interface SwapEstimateResponse {
  estimatedOutput: string;
  fees: Array<{
    type: string;
    amount: string;
    token: string;
  }>;
  priceImpact?: string;
  minOutput?: string;
}

export interface BridgeRequest {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  fromWalletConfig: WalletConfig;
  toWalletConfig: WalletConfig;
  useForwarder?: boolean;
  transferSpeed?: 'FAST' | 'STANDARD';
  recipientAddress?: string;
}

export interface BridgeResponse {
  amount: string;
  token: string;
  state: 'success' | 'error' | 'pending';
  provider: string;
  config: {
    transferSpeed: string;
  };
  source: {
    address: string;
    chain: {
      type: string;
      chain: string;
      chainId: number;
      name: string;
    };
  };
  destination: {
    address: string;
    chain: {
      type: string;
      chain: string;
      chainId: number;
      name: string;
    };
  };
  steps: Array<{
    name: string;
    state: string;
    txHash?: string;
    explorerUrl?: string;
    data?: {
      attestation?: string;
    };
    error?: string;
  }>;
}

export interface BridgeEvent {
  action: string;
  values: {
    txHash?: string;
    state?: string;
    data?: {
      attestation?: string;
    };
    error?: string;
  };
}

export interface TokenCreateRequest {
  name: string;
  symbol: string;
  decimals?: number;
  initialSupply?: string;
  walletId: string;
  blockchain: string;
  mintTo?: string;
}

export interface TokenCreateResponse {
  contractId: string;
  transactionId: string;
  contractAddress?: string;
}

export interface TokenDeployTemplateRequest {
  templateId: string;
  name: string;
  blockchain: string;
  walletId: string;
  templateParameters: Record<string, any>;
}

export interface TokenDeployBytecodeRequest {
  name: string;
  description: string;
  blockchain: string;
  walletId: string;
  abiJson: string;
  bytecode: string;
  constructorParameters?: any[];
}

export interface TokenInteractionRequest {
  contractId: string;
  contractAddress: string;
  blockchain: string;
  walletId: string;
  abiFunctionSignature: string;
  abiParameters: any[];
  abiJson?: any[];
}

export interface TokenQueryRequest {
  contractAddress: string;
  blockchain: string;
  abiFunctionSignature: string;
  abiJson: any[];
  fromAddress?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    swap: 'available' | 'unavailable';
    bridge: 'available' | 'unavailable';
    token: 'available' | 'unavailable';
  };
}