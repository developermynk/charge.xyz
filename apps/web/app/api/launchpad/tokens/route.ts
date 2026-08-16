import { NextRequest, NextResponse } from "next/server";
import { syncFromChain, discover, type SortKey } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

/**
 * GET /api/launchpad/tokens?sort=newest|trending|volume|marketCap&page=1&pageSize=24&q=
 * Discover page. Lazily syncs on-chain events, then returns a paginated,
 * sorted, optionally filtered list.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = (searchParams.get("sort") as SortKey) ?? "newest";
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "24");
  const q = searchParams.get("q") ?? undefined;

  try {
    await syncFromChain();
  } catch {
    /* RPC hiccup: serve what we have */
  }

  const result = discover({ sort, page, pageSize, q });
  return NextResponse.json(result);
}
