import { 
  initiateSmartContractPlatformClient
} from '@circle-fin/smart-contract-platform';
import { config } from '../config';
import crypto from 'crypto';

const scpClient = initiateSmartContractPlatformClient({
  apiKey: config.circle.apiKey,
  entitySecret: config.circle.entitySecret,
});

const ERC20_TEMPLATE_ID = 'a1b74add-23e0-4712-88d1-6b3009e85a86';
const ERC721_TEMPLATE_ID = '76b83278-50e2-4006-8b63-5b1a2a814533';
const ERC1155_TEMPLATE_ID = 'aea21da6-0aa2-4971-9a1a-5098842b1248';
const AIRDROP_TEMPLATE_ID = '13e322f2-18dc-4f57-8eed-4bddfc50f85e';

export interface DeployTemplateParams {
  templateId: string;
  name: string;
  blockchain: string;
  walletId: string;
  templateParameters: Record<string, any>;
  feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DeployBytecodeParams {
  name: string;
  description: string;
  blockchain: string;
  walletId: string;
  abiJson: string;
  bytecode: string;
  constructorParameters?: any[];
  feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ContractExecutionParams {
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: any[];
  feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface QueryContractParams {
  address: string;
  blockchain: string;
  abiFunctionSignature: string;
  abiJson: string;
  fromAddress?: string;
}

export interface ContractInfo {
  contractId: string;
  contractAddress: string;
  name: string;
  blockchain: string;
  deploymentStatus: string;
  transactionId?: string;
}

export class TokenService {
  static async deployTemplate(params: DeployTemplateParams): Promise<ContractInfo> {
    const idempotencyKey = crypto.randomUUID();
    const deployRes = await scpClient.deployContractTemplate({
      id: params.templateId,
      blockchain: params.blockchain as any,
      name: params.name,
      walletId: params.walletId,
      templateParameters: params.templateParameters,
      fee: { type: 'level', config: { feeLevel: params.feeLevel || 'MEDIUM' } },
    });
    const contractId = deployRes.data?.contractIds?.[0];
    const transactionId = deployRes.data?.transactionId;
    if (!contractId) throw new Error('No contract ID returned');
    return { contractId, contractAddress: '', name: params.name, blockchain: params.blockchain, deploymentStatus: 'PENDING', transactionId };
  }

  static async deployBytecode(params: DeployBytecodeParams): Promise<ContractInfo> {
    const idempotencyKey = crypto.randomUUID();
    const deployRes = await scpClient.deployContract({
      name: params.name,
      description: params.description,
      blockchain: params.blockchain as any,
      walletId: params.walletId,
      abiJson: params.abiJson,
      bytecode: params.bytecode,
      constructorParameters: params.constructorParameters || [],
      fee: { type: 'level', config: { feeLevel: params.feeLevel || 'MEDIUM' } },
    });
    const contractId = deployRes.data?.contractId;
    const transactionId = deployRes.data?.transactionId;
    if (!contractId) throw new Error('No contract ID returned');
    return { contractId, contractAddress: '', name: params.name, blockchain: params.blockchain, deploymentStatus: 'PENDING', transactionId };
  }

  static async waitForDeployment(contractId: string, maxAttempts = 60, intervalMs = 5000): Promise<ContractInfo> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const contractRes = await scpClient.getContract({ id: contractId });
      const contract = contractRes.data?.contract;
      if (!contract) throw new Error('Contract not found');
      const deploymentStatus = (contract as any).deploymentStatus;
      if (deploymentStatus === 'COMPLETE') {
        return { contractId: contract.id, contractAddress: (contract as any).contractAddress || (contract as any).address || '', name: contract.name, blockchain: contract.blockchain, deploymentStatus: 'COMPLETE' };
      }
      if (deploymentStatus === 'FAILED') {
        throw new Error(`Deployment failed: ${(contract as any).deploymentErrorReason || 'Unknown'}`);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Deployment timeout');
  }

  static async executeContract(params: ContractExecutionParams): Promise<{ transactionId: string }> {
    const walletsClient = await import('@circle-fin/developer-controlled-wallets').then(m => 
      m.initiateDeveloperControlledWalletsClient({
        apiKey: config.circle.apiKey,
        entitySecret: config.circle.entitySecret,
      })
    );
    const executeRes = await walletsClient.createContractExecutionTransaction({
      walletId: params.walletId,
      contractAddress: params.contractAddress,
      abiFunctionSignature: params.abiFunctionSignature,
      abiParameters: params.abiParameters,
      fee: { type: 'level', config: { feeLevel: params.feeLevel || 'MEDIUM' } },
    });
    return { transactionId: executeRes.data?.id || '' };
  }

  static async queryContract(params: QueryContractParams): Promise<any> {
    const queryRes = await scpClient.queryContract({
      address: params.address,
      blockchain: params.blockchain as any,
      abiFunctionSignature: params.abiFunctionSignature,
      abiJson: params.abiJson,
      fromAddress: params.fromAddress,
    });
    return queryRes.data?.outputValues;
  }

  static async getContract(contractId: string): Promise<any> {
    const contractRes = await scpClient.getContract({ id: contractId });
    return contractRes.data?.contract;
  }

  static async listContracts(filters?: { blockchain?: string; status?: 'COMPLETE' | 'FAILED' | 'PENDING'; name?: string }): Promise<any[]> {
    const listRes = await scpClient.listContracts({
      blockchain: filters?.blockchain as any,
      status: filters?.status,
      name: filters?.name,
    });
    return listRes.data?.contracts || [];
  }

  static async importContract(address: string, blockchain: string, name: string, description?: string): Promise<ContractInfo> {
    const idempotencyKey = crypto.randomUUID();
    const importRes = await scpClient.importContract({ address, blockchain: blockchain as any, name, description, idempotencyKey });
    const contract = importRes.data?.contract;
    if (!contract) throw new Error('No contract returned from import');
    return { contractId: contract.id, contractAddress: (contract as any).contractAddress || (contract as any).address || '', name: contract.name, blockchain: contract.blockchain, deploymentStatus: 'COMPLETE' };
  }

  static async createERC20Token(params: { name: string; symbol: string; decimals: number; initialSupply: string; walletId: string; blockchain: string; feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH'; mintTo?: string }): Promise<ContractInfo> {
    return this.deployTemplate({
      templateId: ERC20_TEMPLATE_ID,
      name: `${params.name} (${params.symbol})`,
      blockchain: params.blockchain,
      walletId: params.walletId,
      templateParameters: { name: params.name, symbol: params.symbol, decimals: params.decimals, initialSupply: params.initialSupply, mintTo: params.mintTo || '' },
      feeLevel: params.feeLevel,
    });
  }

  static async mintERC20(params: { walletId: string; contractAddress: string; to: string; amount: string; tokenId?: string; uri?: string; feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH' }): Promise<{ transactionId: string }> {
    const abiParams = params.tokenId ? [params.to, params.tokenId, params.uri || '', params.amount] : [params.to, params.amount];
    const abiSignature = params.tokenId ? 'mintTo(address,uint256,string,uint256)' : 'mintTo(address,uint256)';
    return this.executeContract({ walletId: params.walletId, contractAddress: params.contractAddress, abiFunctionSignature: abiSignature, abiParameters: abiParams, feeLevel: params.feeLevel });
  }

  static async transferERC20(params: { walletId: string; contractAddress: string; from: string; to: string; amount: string; feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH' }): Promise<{ transactionId: string }> {
    return this.executeContract({ walletId: params.walletId, contractAddress: params.contractAddress, abiFunctionSignature: 'transferFrom(address,address,uint256)', abiParameters: [params.from, params.to, params.amount], feeLevel: params.feeLevel });
  }

  static async getERC20Balance(params: { contractAddress: string; blockchain: string; account: string }): Promise<string> {
    const abiJson = JSON.stringify([{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }]);
    const result = await this.queryContract({ address: params.contractAddress, blockchain: params.blockchain, abiFunctionSignature: 'balanceOf(address)', abiJson, fromAddress: params.account });
    return result?.[0] || '0';
  }

  static async getERC20Info(params: { contractAddress: string; blockchain: string }): Promise<{ name: string; symbol: string; decimals: number; totalSupply: string }> {
    const abiJson = JSON.stringify([
      { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
      { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
      { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
      { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    ]);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      this.queryContract({ address: params.contractAddress, blockchain: params.blockchain, abiFunctionSignature: 'name()', abiJson }),
      this.queryContract({ address: params.contractAddress, blockchain: params.blockchain, abiFunctionSignature: 'symbol()', abiJson }),
      this.queryContract({ address: params.contractAddress, blockchain: params.blockchain, abiFunctionSignature: 'decimals()', abiJson }),
      this.queryContract({ address: params.contractAddress, blockchain: params.blockchain, abiFunctionSignature: 'totalSupply()', abiJson }),
    ]);
    return { name: name?.[0] || '', symbol: symbol?.[0] || '', decimals: Number(decimals?.[0] || 18), totalSupply: totalSupply?.[0] || '0' };
  }

  static async waitForTransaction(transactionId: string, maxAttempts = 30, intervalMs = 5000): Promise<string> {
    const walletsClient = await import('@circle-fin/developer-controlled-wallets').then(m => 
      m.initiateDeveloperControlledWalletsClient({
        apiKey: config.circle.apiKey,
        entitySecret: config.circle.entitySecret,
      })
    );
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const txRes = await walletsClient.getTransaction({ id: transactionId });
      const state = txRes.data?.transaction?.state;
      if (state === 'COMPLETE') return 'COMPLETE';
      if (['FAILED','DENIED','CANCELLED'].includes(state || '')) throw new Error(`Transaction failed: ${state}`);
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Transaction confirmation timeout');
  }
}