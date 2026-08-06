import { NextRequest, NextResponse } from 'next/server';

const CIRCLE_API_URL = 'https://api.circle.com/v1/w3s/developer/wallets';
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET) {
      return NextResponse.json(
        { error: 'CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be configured' },
        { status: 500 }
      );
    }

    console.log('[Wallet Create] Creating developer-controlled wallet...');

    const res = await fetch(CIRCLE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        'X-Entity-Secret': CIRCLE_ENTITY_SECRET,
      },
      body: JSON.stringify({
        // No specific options needed for basic wallet creation
      }),
    });

    const data = await res.json();

    console.log('[Wallet Create] Response:', JSON.stringify(data, null, 2));

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to create wallet', details: data },
        { status: res.status }
      );
    }

    return NextResponse.json({
      walletId: data.data?.walletId,
      walletSetId: data.data?.walletSetId,
      entitySecretCiphertext: data.data?.entitySecretCiphertext,
    });
  } catch (err) {
    console.error('[Wallet Create] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Wallet creation failed' },
      { status: 500 }
    );
  }
}