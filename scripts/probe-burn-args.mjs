// Replicate the EXACT app path: getUserAdapter + AppKit.bridge, but with a
// provider that records the depositForBurn args instead of signing, so we can
// read the destinationDomain the SDK actually computes for "Base_Sepolia".
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

// Capture the depositForBurn calldata args (destinationDomain is arg[1]).
let captured = null;
const provider = {
  request: async ({ method, params }) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return ["0x75d8A073fc6201e240E0E1A0Da8211Bbad34bD8e"];
    if (method === "eth_chainId") return "0x4cef52";
    if (method === "eth_sendTransaction" || method === "wallet_sendCalls") {
      // Don't actually send; just record the request params.
      captured = params;
      return "0x0000000000000000000000000000000000000000000000000000000000000000";
    }
    if (method === "eth_call") return "0x";
    if (method === "estimateGas") return "0x1";
    if (method === "eth_getTransactionReceipt") return null;
    if (method === "eth_getTransactionCount") return "0x0";
    return "0x";
  },
};

const adapter = await createViemAdapterFromProvider({
  provider,
  capabilities: { addressContext: "user-controlled" },
});

const kit = new AppKit();
try {
  await kit.bridge({
    from: { adapter, chain: "Arc_Testnet" },
    to: { adapter, chain: "Base_Sepolia" },
    amount: "1",
    token: "USDC",
  });
} catch (e) {
  // ignore
}

if (captured) {
  console.log("captured tx request. Scanning for destinationDomain (uint32)...");
  const str = JSON.stringify(captured);
  console.log(str.slice(0, 600));
} else {
  console.log("no tx captured");
}
