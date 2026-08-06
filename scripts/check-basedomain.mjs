import { createPublicClient, http, decodeFunctionResult } from "viem";

const BASE_RPC = "https://sepolia.base.org";
// Base Sepolia MessageTransmitter V2 (from SDK chains.mjs)
const MT_V2 = "0xe737e5cebeeba77efe34d4aa090756590b1ce275";

const client = createPublicClient({ transport: http(BASE_RPC) });

// localDomain() returns uint32
const abi = [
  {
    type: "function",
    name: "localDomain",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint32" }],
  },
];

try {
  const hex = await client.readContract({ address: MT_V2, abi, functionName: "localDomain" });
  console.log("Base Sepolia MessageTransmitterV2 localDomain:", hex);
} catch (e) {
  console.log("read error:", e.message);
}
