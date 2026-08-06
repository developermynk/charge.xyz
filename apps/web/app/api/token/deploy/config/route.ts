import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const hasWalletId = !!process.env.CIRCLE_WALLET_ID;
  return NextResponse.json({
    hasWalletId,
    walletIdPreview: hasWalletId ? `${process.env.CIRCLE_WALLET_ID!.slice(0, 8)}...` : null,
  });
}