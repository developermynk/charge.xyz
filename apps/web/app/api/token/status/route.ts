import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const runtime = 'nodejs';

/**
 * GET /api/token/status?contractId=xxx
 * Checks deployment status of a token contract
 */
export async function GET(req: NextRequest) {
  try {
    const contractId = req.nextUrl.searchParams.get('contractId');

    if (!contractId) {
      return NextResponse.json(
        { error: 'contractId query parameter required' },
        { status: 400 }
      );
    }

    const res = await fetch(`${BACKEND_URL}/api/v1/token/deployment/${contractId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'Failed to check deployment status' },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      contractId: data.data?.contractId,
      contractAddress: data.data?.contractAddress,
      deploymentStatus: data.data?.deploymentStatus,
      deploymentErrorReason: data.data?.deploymentErrorReason,
    });
  } catch (err) {
    console.error('[Token Status] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Status check failed' },
      { status: 500 }
    );
  }
}