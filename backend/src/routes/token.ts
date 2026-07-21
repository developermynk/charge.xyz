import { Router, Request, Response } from 'express';
import { 
  initiateSmartContractPlatformClient
} from '@circle-fin/smart-contract-platform';
import { 
  initiateDeveloperControlledWalletsClient 
} from '@circle-fin/developer-controlled-wallets';
import { config } from '../config';

const scpClient = initiateSmartContractPlatformClient({
  apiKey: config.circle.apiKey,
  entitySecret: config.circle.entitySecret,
});

const walletsClient = initiateDeveloperControlledWalletsClient({
  apiKey: config.circle.apiKey,
  entitySecret: config.circle.entitySecret,
});

const ERC20_TEMPLATE_ID = 'a1b74add-23e0-4712-88d1-6b3009e85a86';
const ERC721_TEMPLATE_ID = '76b83278-50e2-4006-8b63-5b1a2a814533';
const ERC1155_TEMPLATE_ID = 'aea21da6-0aa2-4971-9a1a-5098842b1248';

const router = Router();

router.post('/deploy/erc20', async (req: Request, res: Response) => {
  try {
    const { name, symbol, decimals = 18, initialSupply = '0', walletId, blockchain = 'ARC-TESTNET', feeLevel = 'MEDIUM', mintTo } = req.body;
    
    if (!name || !symbol || !walletId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name, symbol, walletId required' } });
    }

    const deployRes = await scpClient.deployContractTemplate({
      id: ERC20_TEMPLATE_ID,
      blockchain,
      name: `${name} (${symbol})`,
      walletId,
      templateParameters: { name, symbol, decimals, initialSupply, mintTo: mintTo || '' },
      fee: { type: 'level', config: { feeLevel } },
    });

    res.json({ success: true, data: { contractId: deployRes.data?.contractIds?.[0], transactionId: deployRes.data?.transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'DEPLOY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.post('/deploy/erc721', async (req: Request, res: Response) => {
  try {
    const { name, symbol, walletId, blockchain = 'ARC-TESTNET', feeLevel = 'MEDIUM', baseURI = '', royaltyRecipient = '', royaltyPercent = 0 } = req.body;
    
    if (!name || !symbol || !walletId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name, symbol, walletId required' } });
    }

    const deployRes = await scpClient.deployContractTemplate({
      id: ERC721_TEMPLATE_ID,
      blockchain,
      name: `${name} (${symbol})`,
      walletId,
      templateParameters: { name, symbol, baseURI, royaltyRecipient, royaltyPercent },
      fee: { type: 'level', config: { feeLevel } },
    });

    res.json({ success: true, data: { contractId: deployRes.data?.contractIds?.[0], transactionId: deployRes.data?.transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'DEPLOY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.post('/deploy/erc1155', async (req: Request, res: Response) => {
  try {
    const { name, symbol, walletId, blockchain = 'ARC-TESTNET', feeLevel = 'MEDIUM', defaultAdmin, primarySaleRecipient, royaltyRecipient, royaltyPercent = 0 } = req.body;
    
    if (!name || !symbol || !walletId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name, symbol, walletId required' } });
    }

    const deployRes = await scpClient.deployContractTemplate({
      id: ERC1155_TEMPLATE_ID,
      blockchain,
      name: `${name} (${symbol})`,
      walletId,
      templateParameters: { name, defaultAdmin: defaultAdmin || '', primarySaleRecipient: primarySaleRecipient || '', royaltyRecipient: royaltyRecipient || '', royaltyPercent },
      fee: { type: 'level', config: { feeLevel } },
    });

    res.json({ success: true, data: { contractId: deployRes.data?.contractIds?.[0], transactionId: deployRes.data?.transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'DEPLOY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.post('/deploy/template', async (req: Request, res: Response) => {
  try {
    const { templateId, name, blockchain, walletId, templateParameters, feeLevel = 'MEDIUM' } = req.body;
    
    if (!templateId || !name || !blockchain || !walletId || !templateParameters) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'templateId, name, blockchain, walletId, templateParameters required' } });
    }

    const deployRes = await scpClient.deployContractTemplate({
      id: templateId,
      blockchain,
      name,
      walletId,
      templateParameters,
      fee: { type: 'level', config: { feeLevel } },
    });

    res.json({ success: true, data: { contractId: deployRes.data?.contractIds?.[0], transactionId: deployRes.data?.transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'DEPLOY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.post('/deploy/bytecode', async (req: Request, res: Response) => {
  try {
    const { name, description, blockchain, walletId, abiJson, bytecode, constructorParameters = [], feeLevel = 'MEDIUM' } = req.body;
    
    if (!name || !blockchain || !walletId || !abiJson || !bytecode) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name, blockchain, walletId, abiJson, bytecode required' } });
    }

    const deployRes = await scpClient.deployContract({
      name, description, blockchain, walletId, abiJson, bytecode, constructorParameters,
      fee: { type: 'level', config: { feeLevel } },
    });

    res.json({ success: true, data: { contractId: deployRes.data?.contractId, transactionId: deployRes.data?.transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'DEPLOY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.get('/deployment/:contractId', async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const contractRes = await scpClient.getContract({ id: contractId });
    const contract = contractRes.data?.contract;
    
    if (!contract) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Contract not found' } });
    }

    res.json({ success: true, data: { contractId: contract.id, contractAddress: contract.contractAddress || contract.address, deploymentStatus: contract.deploymentStatus, deploymentErrorReason: contract.deploymentErrorReason } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'CHECK_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { walletId, contractAddress, abiFunctionSignature, abiParameters, feeLevel = 'MEDIUM' } = req.body;
    
    if (!walletId || !contractAddress || !abiFunctionSignature || !abiParameters) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'walletId, contractAddress, abiFunctionSignature, abiParameters required' } });
    }

    const executeRes = await walletsClient.createContractExecutionTransaction({
      walletId, contractAddress, abiFunctionSignature, abiParameters,
      fee: { type: 'level', config: { feeLevel } },
    });

    res.json({ success: true, data: { transactionId: executeRes.data?.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'EXECUTE_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.post('/query', async (req: Request, res: Response) => {
  try {
    const { address, blockchain, abiFunctionSignature, abiJson, fromAddress } = req.body;
    
    if (!address || !blockchain || !abiFunctionSignature || !abiJson) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'address, blockchain, abiFunctionSignature, abiJson required' } });
    }

    const queryRes = await scpClient.queryContract({ address, blockchain, abiFunctionSignature, abiJson, fromAddress });
    res.json({ success: true, data: queryRes.data?.outputValues });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'QUERY_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.post('/erc20/mint', async (req: Request, res: Response) => {
  try {
    const { walletId, contractAddress, to, amount, feeLevel = 'MEDIUM' } = req.body;
    
    if (!walletId || !contractAddress || !to || !amount) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'walletId, contractAddress, to, amount required' } });
    }

    const executeRes = await walletsClient.createContractExecutionTransaction({
      walletId, contractAddress,
      abiFunctionSignature: 'mintTo(address,uint256)',
      abiParameters: [to, amount],
      fee: { type: 'level', config: { feeLevel } },
    });

    res.json({ success: true, data: { transactionId: executeRes.data?.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'MINT_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.post('/erc20/transfer', async (req: Request, res: Response) => {
  try {
    const { walletId, contractAddress, from, to, amount, feeLevel = 'MEDIUM' } = req.body;
    
    if (!walletId || !contractAddress || !from || !to || !amount) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'walletId, contractAddress, from, to, amount required' } });
    }

    const executeRes = await walletsClient.createContractExecutionTransaction({
      walletId, contractAddress,
      abiFunctionSignature: 'transferFrom(address,address,uint256)',
      abiParameters: [from, to, amount],
      fee: { type: 'level', config: { feeLevel } },
    });

    res.json({ success: true, data: { transactionId: executeRes.data?.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'TRANSFER_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.get('/erc20/balance', async (req: Request, res: Response) => {
  try {
    const { contractAddress, blockchain, account } = req.query;
    
    if (!contractAddress || !blockchain || !account) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'contractAddress, blockchain, account required' } });
    }

    const queryRes = await scpClient.queryContract({
      address: contractAddress as string,
      blockchain: blockchain as string,
      abiFunctionSignature: 'balanceOf(address)',
      abiJson: JSON.stringify([{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }]),
      fromAddress: account as string,
    });

    res.json({ success: true, data: { balance: queryRes.data?.outputValues?.[0] || '0' } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'BALANCE_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.get('/erc20/info', async (req: Request, res: Response) => {
  try {
    const { contractAddress, blockchain } = req.query;
    
    if (!contractAddress || !blockchain) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'contractAddress, blockchain required' } });
    }

    const abiJson = JSON.stringify([
      { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
      { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
      { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
      { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    ]);

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      scpClient.queryContract({ address: contractAddress as string, blockchain: blockchain as string, abiFunctionSignature: 'name()', abiJson }),
      scpClient.queryContract({ address: contractAddress as string, blockchain: blockchain as string, abiFunctionSignature: 'symbol()', abiJson }),
      scpClient.queryContract({ address: contractAddress as string, blockchain: blockchain as string, abiFunctionSignature: 'decimals()', abiJson }),
      scpClient.queryContract({ address: contractAddress as string, blockchain: blockchain as string, abiFunctionSignature: 'totalSupply()', abiJson }),
    ]);

    res.json({ 
      success: true, 
      data: { 
        name: name.data?.outputValues?.[0] || '', 
        symbol: symbol.data?.outputValues?.[0] || '', 
        decimals: Number(decimals.data?.outputValues?.[0] || 18), 
        totalSupply: totalSupply.data?.outputValues?.[0] || '0' 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INFO_FAILED', message: error instanceof Error ? error.message : 'Unknown error' } });
  }
});

router.get('/templates', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      templates: [
        { id: ERC20_TEMPLATE_ID, name: 'ERC-20 Token', standard: 'ERC-20', description: 'Fungible token standard' },
        { id: ERC721_TEMPLATE_ID, name: 'ERC-721 NFT', standard: 'ERC-721', description: 'Non-fungible token standard' },
        { id: ERC1155_TEMPLATE_ID, name: 'ERC-1155 Multi-Token', standard: 'ERC-1155', description: 'Multi-token standard (fungible + non-fungible)' },
        { id: '13e322f2-18dc-4f57-8eed-4bddfc50f85e', name: 'Airdrop', standard: 'Custom', description: 'Bulk token distribution contract' },
      ],
    },
  });
});

export default router;