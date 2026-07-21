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

import { useBalance } from "wagmi";
import { formatUnits } from "viem";
import { useWallet } from "@repo/hooks/WalletContext";
import { arcTestnet } from "@repo/hooks/wagmi";

/**
 * Reads the connected wallet's real native (USDC on Arc Testnet) balance
 * on-chain. Works for both the injected wallet and the Circle smart account
 * since it queries by address against the configured Arc Testnet transport.
 */
export function useWalletBalance() {
  const { address } = useWallet();
  const { data, isLoading, refetch } = useBalance({
    address,
    chainId: arcTestnet.id,
    query: { enabled: !!address },
  });

  const symbol = data?.symbol ?? arcTestnet.nativeCurrency.symbol;
  const amount = data ? Number(formatUnits(data.value, data.decimals)) : undefined;
  const formatted =
    amount === undefined
      ? null
      : `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`;

  return { amount, symbol, formatted, isLoading, refetch };
}
