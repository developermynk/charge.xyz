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

import { WalletModalProvider } from "@/components/charge/WalletModalContext";
import { LandingNav } from "@/components/charge/sections/LandingNav";
import { LandingHero } from "@/components/charge/sections/LandingHero";
import { LandingStats } from "@/components/charge/sections/LandingStats";
import { LandingFeatures } from "@/components/charge/sections/LandingFeatures";
import { LandingCTA } from "@/components/charge/sections/LandingCTA";
import { LandingFooter } from "@/components/charge/sections/LandingFooter";

export default function Home() {
  return (
    <WalletModalProvider>
      <div className="bg-charge-bg font-body text-ink">
        <LandingNav />
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingCTA />
        <LandingFooter />
      </div>
    </WalletModalProvider>
  );
}
