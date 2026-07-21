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

import { type ReactNode } from "react";
import { GlassCard } from "@/components/charge/ui";
import { NAV_ITEMS } from "@/components/charge/data";
import { DashboardStats } from "./DashboardStats";
// GlassCard is still used for the panel wrapper below.

export function DashboardFrame({
  tabId,
  children,
}: {
  tabId: string;
  children: ReactNode;
}) {
  const current = NAV_ITEMS.find((n) => n.id === tabId)!;

  return (
    <main className="flex-1 overflow-y-auto px-6 py-8 md:px-12">
      <div className="mx-auto w-full max-w-[800px]">
        <div className="mb-8">
        <div className="mb-1.5 flex items-center gap-3">
          <span className="text-2xl text-lime">{current.icon}</span>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.02em] text-ink">
            {current.label}
          </h1>
        </div>
        <p className="m-0 text-[14px] text-ink-2">{current.desc}</p>
      </div>

      <DashboardStats />

        <div className="flex justify-center">
          <GlassCard className="w-full max-w-[520px]" style={{ padding: 24 }}>
            {children}
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
