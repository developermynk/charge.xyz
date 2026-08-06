import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

// Dummy EIP-1193 provider (won't sign; we only prepare, not send)
const provider = {
  request: async ({ method }) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return ["0x75d8A073fc6201e240E0E1A0Da8211Bbad34bD8e"];
    if (method === "eth_chainId") return "0x4cef52"; // Arc Testnet
    throw new Error("probe: no-sign");
  },
};

const adapter = await createViemAdapterFromProvider({
  provider,
  capabilities: { addressContext: "user-controlled" },
});

const kit = new AppKit();

async function run(toChain) {
  try {
    const r = await kit.bridge({
      from: { adapter, chain: "Arc_Testnet" },
      to: { adapter, chain: toChain },
      amount: "1",
      token: "USDC",
    });
    console.log(`toChain=${toChain} -> RETURNED state=${r.state} steps=${JSON.stringify(r.steps?.map(s=>s.name+":"+s.state))}`);
  } catch (e) {
    console.log(`toChain=${toChain} -> ERROR: ${e?.message ?? e}`);
  }
}

await run("Base_Sepolia");
await run("Arc_Testnet");
