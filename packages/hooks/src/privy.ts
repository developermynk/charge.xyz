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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, OR ALL WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied, see the License for
 * specific language governing permissions and limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Privy configuration mirror of circle.ts. The PrivyProvider can only be
// rendered when a real app id is present, so login with Privy is gated on this.
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

const PLACEHOLDER_VALUES = ["your_privy_app_id_here", ""];

export function isPrivyConfigured(): boolean {
  return !PLACEHOLDER_VALUES.includes(appId);
}

export const PRIVY_APP_ID = appId;
