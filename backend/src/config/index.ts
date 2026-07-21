import dotenv from 'dotenv';

dotenv.config();

interface CircleConfig {
  apiKey: string;
  entitySecret: string;
  kitKey: string;
  baseUrl: string;
}

interface WalletConfig {
  evmPrivateKey?: string;
  solanaPrivateKey?: string;
  circleApiKey?: string;
  circleEntitySecret?: string;
  evmWalletAddress?: string;
  solanaWalletAddress?: string;
}

interface ServerConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
}

interface Config {
  circle: CircleConfig;
  wallet: WalletConfig;
  server: ServerConfig;
}

const config: Config = {
  circle: {
    apiKey: process.env.CIRCLE_API_KEY || '',
    entitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
    kitKey: process.env.KIT_KEY || '',
    baseUrl: process.env.CIRCLE_BASE_URL || 'https://api.circle.com',
  },
  wallet: {
    evmPrivateKey: process.env.EVM_PRIVATE_KEY,
    solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
    circleApiKey: process.env.CIRCLE_API_KEY,
    circleEntitySecret: process.env.CIRCLE_ENTITY_SECRET,
    evmWalletAddress: process.env.EVM_WALLET_ADDRESS,
    solanaWalletAddress: process.env.SOLANA_WALLET_ADDRESS,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
};

export { config };