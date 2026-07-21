/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in the License at
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

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { WalletModal } from "./WalletModal";
import { useRouter } from "next/navigation";
import { useWallet } from "@repo/hooks/WalletContext";

interface WalletModalContextValue {
  open: () => void;
  close: () => void;
}

const WalletModalContext = createContext<WalletModalContextValue | null>(null);

export function useWalletModal() {
  const ctx = useContext(WalletModalContext);
  if (!ctx) throw new Error("useWalletModal must be used within WalletModalProvider");
  return ctx;
}

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  // Set once the user initiates a login from the modal; drives the redirect to
  // the dashboard once the wallet actually connects (which may happen after the
  // custom modal is closed to reveal Privy's own modal).
  const [awaitingLogin, setAwaitingLogin] = useState(false);
  const router = useRouter();
  const { isConnected } = useWallet();

  const open = useCallback(() => {
    // Already connected → straight to the dashboard, no popup needed.
    if (isConnected) {
      router.push("/dashboard");
      return;
    }
    setShow(true);
  }, [isConnected, router]);

  const close = useCallback(() => {
    setShow(false);
    setAwaitingLogin(false);
  }, []);

  const beginLogin = useCallback(() => setAwaitingLogin(true), []);

  // Redirect to the dashboard as soon as a login the user initiated succeeds.
  useEffect(() => {
    if (awaitingLogin && isConnected) {
      setAwaitingLogin(false);
      setShow(false);
      router.push("/dashboard");
    }
  }, [awaitingLogin, isConnected, router]);

  // Stable value so landing-section consumers don't re-render on every render.
  const value = useMemo<WalletModalContextValue>(() => ({ open, close }), [open, close]);

  return (
    <WalletModalContext.Provider value={value}>
      {children}
      {show && <WalletModal onClose={close} onBeginLogin={beginLogin} />}
    </WalletModalContext.Provider>
  );
}
