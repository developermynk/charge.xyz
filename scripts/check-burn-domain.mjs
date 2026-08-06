import { keccak256, toBytes, decodeAbiParameters } from "viem";

const ARC_RPC = "https://rpc.testnet.arc.network/";
const TX = "0xf764e5aee5aed89ee359dd72970d5db6b432f4bbf54512ad2a6371416dcbcecd";

// DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)
const DEPOSIT_TOPIC = keccak256(
  toBytes(
    "DepositForBurn(uint64,address,uint256,address,bytes32,uint32,bytes32,bytes32)",
  ),
);

const res = await fetch(ARC_RPC, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getTransactionReceipt",
    params: [TX],
  }),
});

const r = (await res.json()).result;
if (!r) {
  console.log("no receipt");
  process.exit(1);
}

console.log("num logs:", r.logs.length);
for (const l of r.logs) {
  if (l.address.toLowerCase() === "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa") {
    console.log("TOKEN MESSENGER LOG");
    console.log("topics:", JSON.stringify(l.topics));
    console.log("data:", l.data);
    // DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)
    // data holds: amount(uint256), mintRecipient(bytes32), destinationDomain(uint32), destinationTokenMessenger(bytes32), destinationCaller(bytes32)
    try {
      const decoded = decodeAbiParameters(
        [
          { type: "uint256" },
          { type: "bytes32" },
          { type: "uint32" },
          { type: "bytes32" },
          { type: "bytes32" },
        ],
        l.data,
      );
      console.log("amount:", decoded[0].toString());
      console.log("mintRecipient:", decoded[1]);
      console.log("destinationDomain:", decoded[2], "(Base Sepolia should be 6)");
      console.log("destinationTokenMessenger:", decoded[3]);
      console.log("destinationCaller:", decoded[4]);
    } catch (e) {
      console.log("decode error:", e.message);
    }
  }
}
