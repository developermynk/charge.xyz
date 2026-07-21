/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useState } from "react";
import { parseUnits, isAddress, type Hex } from "viem";
import { useSendTransaction, useSwitchChain } from "wagmi";
import { useWallet } from "@repo/hooks/WalletContext";
import { arcTestnet } from "@repo/hooks/wagmi";

export type TransferStatus = "idle" | "pending" | "success" | "error";

const EXPLORER = arcTestnet.blockExplorers?.default.url ?? "";

/**
 * Sends a REAL native-USDC transfer on Arc Testnet.
 * - Circle smart account (Privy login): a gasless UserOperation via the Circle
 *   bundler (paymaster sponsors gas).
 * - Injected wallet: a normal transaction via wagmi.
 */
export function useTransfer() {
  const { walletType, bundlerClient } = useWallet();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();

  const [status, setStatus] = useState<TransferStatus>("idle");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const explorerUrl = txHash && EXPLORER ? `${EXPLORER}/tx/${txHash}` : null;

  const reset = () => {
    setStatus("idle");
    setTxHash(null);
    setError(null);
  };

  const send = async (to: string, amount: string) => {
    setError(null);
    setTxHash(null);

    if (!isAddress(to)) {
      setError("Enter a valid recipient address (0x…).");
      setStatus("error");
      return;
    }
    let value: bigint;
    try {
      value = parseUnits(amount || "0", arcTestnet.nativeCurrency.decimals);
    } catch {
      setError("Enter a valid amount.");
      setStatus("error");
      return;
    }
    if (value <= 0n) {
      setError("Amount must be greater than 0.");
      setStatus("error");
      return;
    }

    setStatus("pending");
    try {
      if (walletType === "circle") {
        if (!bundlerClient) throw new Error("Wallet is still initializing — try again in a moment.");
        const hash = await bundlerClient.sendUserOperation({
          calls: [{ to: to as Hex, data: "0x", value }],
          paymaster: true,
        });
        const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash });
        setTxHash(receipt.transactionHash);
      } else if (walletType === "metamask") {
        // The injected wallet (e.g. MetaMask) may be on another network; wagmi
        // rejects the tx with a chain-mismatch error unless we switch it to Arc
        // Testnet first. switchChainAsync also adds the network if missing.
        await switchChainAsync({ chainId: arcTestnet.id });
        const hash = await sendTransactionAsync({
          to: to as Hex,
          value,
          chainId: arcTestnet.id,
        });
        setTxHash(hash);
      } else {
        throw new Error("Connect a wallet first.");
      }
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
      setStatus("error");
    }
  };

  return { send, reset, status, txHash, explorerUrl, error };
}
