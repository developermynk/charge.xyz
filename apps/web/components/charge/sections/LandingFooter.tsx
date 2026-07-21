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

const FOOTER_LINKS = ["Terms", "Privacy", "Docs", "Twitter", "Discord"];

export function LandingFooter() {
  return (
    <footer className="flex flex-col items-center justify-between gap-4 border-t border-line px-6 py-8 md:flex-row md:px-12">
      <div className="flex items-center gap-2">
        <span className="font-display text-lg font-bold text-lime">⚡ Charge.xyz</span>
        <span className="ml-2 text-[12px] text-ink-3">© 2026 All rights reserved.</span>
      </div>
      <div className="flex gap-6">
        {FOOTER_LINKS.map((l) => (
          <span
            key={l}
            className="cursor-pointer text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
          >
            {l}
          </span>
        ))}
      </div>
    </footer>
  );
}
