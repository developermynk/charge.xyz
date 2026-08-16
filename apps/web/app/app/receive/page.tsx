"use client";

import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Network } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { Badge, Button, Card } from "@charge/ui";
import { useWallet } from "@charge/web3";
import { EVM_CHAIN_BY_ID, ALL_CHAIN_IDS } from "@charge/chains";

import { BackButton } from "@/components/app/back-button";

export default function ReceivePage() {
  const { address, method } = useWallet();
  const params = useSearchParams();
  const [copied, setCopied] = React.useState(false);

  const chainIdParam = Number(params.get("chain"));
  const chainId =
    ALL_CHAIN_IDS.includes(chainIdParam) ? chainIdParam : undefined;
  const def = chainId ? EVM_CHAIN_BY_ID.get(chainId) : undefined;

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Receive</h1>
        <p className="mt-1 text-fg-secondary">
          Share your address or let someone scan the QR to send you assets.
        </p>
      </header>

      {!address ? (
        <Card className="border-warning/25 bg-warning/[0.07] p-4">
          <p className="text-sm text-fg">
            Connect a wallet to see your receive address.
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-5 p-6 sm:p-8">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={address} size={208} level="M" />
          </div>

          <div className="w-full max-w-md text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Badge tone={method === "email" ? "charge" : "accent"}>
                {method === "email" ? "Email account" : "Connected wallet"}
              </Badge>
              {def && (
                <Badge tone="neutral" className="gap-1">
                  <Network className="size-3" aria-hidden />
                  {def.name}
                </Badge>
              )}
            </div>
            <p className="break-all font-mono text-sm text-fg">{address}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void copyAddress()}
            >
              {copied ? (
                <>
                  <Check className="size-3.5" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden />
                  Copy address
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
