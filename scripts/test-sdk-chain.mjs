// Import the SDK's chain resolution to see what domain "Base_Sepolia" maps to.
import { AppKit } from "@circle-fin/app-kit";

// Reach into the bundled chains via a bridge call's internal resolution is hard;
// instead inspect the exported chains if present, else brute-force via bridge().
// The simplest check: does the SDK know "Base_Sepolia"?
// We can read it from the BridgeChain enum / ChainDefinition.

// The app-kit re-exports nothing public for chains, so test indirectly:
// call getAppKit().bridge with a clearly-wrong vs correct chain and compare errors.
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

const provider = {
  request: async () => {
    throw new Error("probe only");
  },
};

async function tryChain(toChain) {
  try {
    const adapter = await createViemAdapterFromProvider({
      provider: provider,
      capabilities: { addressContext: "user-controlled" },
    });
    const kit = new AppKit();
    await kit.bridge({
      from: { adapter, chain: "Arc_Testnet" },
      to: { adapter, chain: toChain },
      amount: "1",
      token: "USDC",
    });
  } catch (e) {
    return e.message;
  }
  return "no-error";
}

for (const c of ["Base_Sepolia", "BaseSepolia", "base_sepolia", "BASE-SEPOLIA", "Base"]) {
  const msg = await tryChain(c);
  console.log(JSON.stringify(c), "->", msg.slice(0, 160));
}
