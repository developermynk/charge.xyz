import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const runtime = 'nodejs';

/**
 * POST /api/token/deploy
 * Body: { name, symbol, decimals, supply, mintable, burnable, pausable, chain }
 * Deploys an ERC-20 token via Circle Smart Contract Platform
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { name, symbol, decimals = 18, supply, mintable, burnable, pausable, chain } = body;

    if (!name || !symbol) {
      return NextResponse.json(
        { error: 'Token name and symbol are required' },
        { status: 400 }
      );
    }

    const walletId = process.env.CIRCLE_WALLET_ID;

    if (!walletId) {
      return NextResponse.json(
        { error: 'CIRCLE_WALLET_ID not configured in server environment' },
        { status: 500 }
      );
    }

    // Map chain code to backend blockchain identifier (use hyphen format: ARC-TESTNET)
    const blockchain = chain?.code?.replace('_', '-') || 'ARC-TESTNET';

    // Transform form data to backend API format - matches backend/src/routes/token.ts expectations
    const deployPayload = {
      name,
      symbol,
      decimals: Number(decimals),
      initialSupply: supply || '0',
      walletId,
      blockchain,
      feeLevel: 'MEDIUM',
    };

    console.log('[Token Deploy] Request:', { name, symbol, blockchain, decimals: deployPayload.decimals, walletId: walletId ? 'SET' : 'MISSING' });

    // Call backend token deployment API
    const res = await fetch(`${BACKEND_URL}/api/v1/token/deploy/erc20`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deployPayload),
    });

    const responseText = await res.text();
    console.log('[Token Deploy] Backend raw response:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!res.ok) {
      console.error('[Token Deploy] Backend error:', data);
      return NextResponse.json(
        { error: data.error?.message || `Backend error (${res.status}): ${responseText}` },
        { status: res.status }
      );
    }

    console.log('[Token Deploy] Success:', { contractId: data.data?.contractId, transactionId: data.data?.transactionId });

    return NextResponse.json({
      success: true,
      contractId: data.data?.contractId,
      transactionId: data.data?.transactionId,
      message: 'Token deployment initiated. Check deployment status via /api/token/status',
    });
  } catch (err) {
    console.error('[Token Deploy] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Deployment failed' },
      { status: 500 }
    );
  }
}