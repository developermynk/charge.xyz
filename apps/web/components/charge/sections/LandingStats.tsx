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

const STATS = [
  { value: "$0", label: "Total Volume", note: "Live from protocol" },
  { value: "0", label: "Transactions", note: "On-chain count" },
  { value: "12", label: "Chains Supported", note: "" },
  { value: "<0.8s", label: "Avg. Swap Time", note: "" },
];

export function LandingStats() {
  return (
    <section className="border-y border-line bg-surface-1 px-6 py-8 md:px-12">
      <div className="mx-auto grid max-w-[900px] grid-cols-2 gap-8 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-display text-[42px] font-bold leading-none tracking-[-0.03em] text-lime">
              {s.value}
            </div>
            <div className="mt-1.5 text-[13px] font-medium uppercase tracking-[0.04em] text-ink-3">
              {s.label}
            </div>
            {s.note && (
              <div className="mt-1 text-[11px] text-ink-3 opacity-60">{s.note}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
