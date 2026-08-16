"use client";

import {
  Check,
  Coins,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  ShieldCheck,
  Twitter,
  Send,
  Globe,
  Flame,
} from "lucide-react";
import * as React from "react";

import {
  Button,
  Card,
  DetailRow,
  Input,
  Label,
  StatusLine,
  Switch,
} from "@charge/ui";
import { arcAddressUrl, bridgeAddParams } from "@charge/chains";
import { CHARGETOKENV2_BYTECODE } from "@charge/contracts/v2";
import {
  launchTokenV2,
  validateTokenParams,
  type LaunchTokenV2Result,
} from "@charge/sdk";
import { useArcBalance, useWallet } from "@charge/web3";

type Phase = "idle" | "signing" | "pending" | "seeding" | "done" | "error";

const DEFAULT_SUPPLY = "1000000000"; // 1 billion

interface Socials {
  twitter: string;
  telegram: string;
  website: string;
}

/**
 * Normalize a raw social input into a canonical, type-correct URL.
 * Each field keeps its own type so the detail page can render the right
 * icon/link: X -> https://x.com/<handle>, Telegram -> https://t.me/<user>,
 * Website -> https://<host>. Empty input stays empty (all three optional).
 */
function normalizeSocials(raw: Socials): Socials {
  const trim = (s: string) => (s ?? "").trim();
  const twitterRaw = trim(raw.twitter).replace(/^@/, "");
  const twitter = twitterRaw
    ? (/^https?:\/\//i.test(twitterRaw)
        ? twitterRaw
        : `https://x.com/${twitterRaw.replace(/^x\.com\//i, "").replace(/^\//, "")}`)
    : "";
  const tgRaw = trim(raw.telegram).replace(/^@/, "");
  const telegram = tgRaw
    ? /^https?:\/\//i.test(tgRaw)
      ? tgRaw
      : `https://t.me/${tgRaw.replace(/^t\.me\//i, "").replace(/^\//, "")}`
    : "";
  let web = trim(raw.website);
  if (web && !/^https?:\/\//i.test(web)) web = `https://${web}`;
  return { twitter, telegram, website: web };
}

export function CreateTokenPanel() {
  const { address, getProvider, switchToArc } = useWallet();
  const balance = useArcBalance(address);

  const [name, setName] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [supply, setSupply] = React.useState(DEFAULT_SUPPLY);
  const [decimals, setDecimals] = React.useState("18");
  const [image, setImage] = React.useState<string | null>(null);
  const [socials, setSocials] = React.useState<Socials>({
    twitter: "",
    telegram: "",
    website: "",
  });
  const [mintable, setMintable] = React.useState(false);
  const [burnable, setBurnable] = React.useState(false);
  const [seedUsdc, setSeedUsdc] = React.useState("");

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LaunchTokenV2Result | null>(null);
  const [copied, setCopied] = React.useState(false);

  const validation = React.useMemo(
    () =>
      validateTokenParams({
        name,
        symbol,
        totalSupply: supply,
        decimals: Number(decimals),
      }),
    [name, symbol, supply, decimals],
  );

  const touched =
    name.length > 0 || symbol.length > 0 || supply.length > 0;
  const canSubmit =
    validation.ok && phase !== "signing" && phase !== "pending";

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setError("Image must be under ~1.5 MB for the testnet indexer.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  /**
   * Ensure the connected wallet is on Arc Testnet before we deploy. Injected
   * wallets (MetaMask, OKX, Rabby, ...) do not ship with Arc pre-added, so a
   * raw `deployContract` is rejected with an unrecognized-chainId error. We
   * switch first, and if the wallet doesn't know the chain yet we add it via
   * `wallet_addEthereumChain`, then switch again. This is the root-cause fix
   * for "deploy fails on MetaMask/OKX".
   */
  async function ensureArc() {
    const provider = await getProvider();
    if (!provider) {
      // No injected provider (e.g. Privy email) — rely on switchToArc path.
      await switchToArc();
      return;
    }
    try {
      await switchToArc();
      return;
    } catch {
      /* fall through to add-chain */
    }
    const params = bridgeAddParams("Arc_Testnet");
    if (params && "request" in provider) {
      try {
        await (provider as { request: (a: { method: string; params: unknown[] }) => Promise<unknown> }).request({
          method: "wallet_addEthereumChain",
          params: [params],
        });
        await switchToArc();
      } catch (err) {
        // User dismissed the add-network prompt, or wallet rejected it.
        throw new Error(
          err instanceof Error && /user rejected|user denied/i.test(err.message)
            ? "You declined to add Arc Testnet. Add it in your wallet to deploy."
            : "Could not switch to Arc Testnet. Switch your wallet network manually and retry.",
        );
      }
    } else {
      await switchToArc();
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !address) return;

    setError(null);
    setResult(null);
    setPhase("signing");

    try {
      // Root-cause fix: injected wallets (MetaMask/OKX) don't have Arc Testnet
      // pre-added. Without it, `deployContract` is rejected by the wallet with
      // an unrecognized-chainId error. Add + switch the network first so the
      // deploy succeeds on any EVM wallet, not just ones that already know Arc.
      await ensureArc();

      const provider = await getProvider();
      if (!provider) throw new Error("No wallet provider available.");

      setPhase("pending");
      const res = await launchTokenV2(
        {
          provider,
          account: address,
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          totalSupply: supply,
          decimals: Number(decimals),
          mintable,
          burnable,
          seedUsdc: seedUsdc || "0",
        },
        CHARGETOKENV2_BYTECODE,
      );

      // Persist metadata to the Charge indexer so the token shows up in
      // Market + the DexScreener-style detail page. Best-effort: a failed
      // index write must not block the already-deployed token.
      try {
        await fetch("/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: res.contractAddress,
            name: name.trim(),
            symbol: symbol.trim().toUpperCase(),
            description: description.trim(),
            image,
            decimals: Number(decimals),
            totalSupply: supply,
            mintable: res.mintable,
            burnable: res.burnable,
            owner: address,
            socials: normalizeSocials(socials),
            poolSeeded: res.poolSeeded,
          }),
        });
      } catch {
        /* indexer optional */
      }

      if (res.poolSeeded) setPhase("seeding");
      setResult(res);
      setPhase("done");
      balance.refetch();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The token could not be deployed.",
      );
      setPhase("error");
    }
  }

  async function copyAddress() {
    if (!result) return;
    await navigator.clipboard.writeText(result.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const busy =
    phase === "signing" || phase === "pending" || phase === "seeding";

  if (phase === "done" && result) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/15 text-success">
            <Check className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            {name} is live on Arc
          </h2>
          <p className="mt-1.5 text-fg-secondary">
            {result.poolSeeded
              ? "Token deployed and a USDC pool is live — anyone can buy it now."
              : "Token deployed. Add liquidity from the token page to make it tradeable."}
          </p>
        </div>

        <Card className="p-4">
          <DetailRow label="Name" value={name} />
          <DetailRow label="Symbol" value={symbol.toUpperCase()} />
          <DetailRow label="Total supply" value={supply} />
          <DetailRow label="Decimals" value={decimals} />
          <DetailRow
            label="Mintable"
            value={result.mintable ? "YES — owner can inflate" : "No"}
          />
          <DetailRow
            label="Burnable"
            value={result.burnable ? "Yes (holders burn own)" : "No"}
          />
          <DetailRow
            label="Liquidity"
            value={result.poolSeeded ? "Seeded (USDC pool)" : "Not seeded"}
          />
        </Card>

        <div>
          <Label>Contract address</Label>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-fg/10 bg-fg/[0.03] px-4 py-3 font-mono text-sm">
              {result.contractAddress}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyAddress()}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" asChild>
            <a
              href={`/app/token/${result.contractAddress}`}
              className="inline-flex items-center gap-2"
            >
              View token page
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a
              href={arcAddressUrl(result.contractAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              View contract
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        </div>

        <Button
          block
          variant="secondary"
          onClick={() => {
            setPhase("idle");
            setResult(null);
            setName("");
            setSymbol("");
            setDescription("");
            setSupply(DEFAULT_SUPPLY);
            setImage(null);
            setSocials({ twitter: "", telegram: "", website: "" });
            setMintable(false);
            setBurnable(false);
            setSeedUsdc("");
          }}
        >
          Launch another token
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="token-name">Token name</Label>
          <Input
            id="token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Charge Points"
            maxLength={64}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="token-symbol">Symbol</Label>
          <Input
            id="token-symbol"
            value={symbol}
            onChange={(e) =>
              setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            placeholder="CHRG"
            maxLength={11}
            className="mt-2 font-mono uppercase"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="token-desc">Description</Label>
        <textarea
          id="token-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this token about?"
          maxLength={280}
          rows={3}
          className="mt-2 w-full rounded-xl border border-fg/10 bg-fg/[0.03] px-4 py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-tertiary focus:border-charge/50"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="token-supply">Total supply</Label>
          <Input
            id="token-supply"
            value={supply}
            onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="1000000000"
            inputMode="numeric"
            className="mt-2 tabular-nums"
          />
        </div>
        <div>
          <Label htmlFor="token-decimals">Decimals</Label>
          <Input
            id="token-decimals"
            value={decimals}
            onChange={(e) =>
              setDecimals(e.target.value.replace(/[^\d]/g, "").slice(0, 2))
            }
            inputMode="numeric"
            className="mt-2 tabular-nums"
          />
        </div>
      </div>

      <div>
        <Label>Token image</Label>
        <div className="mt-2 flex items-center gap-4">
          <label className="flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-fg/20 bg-fg/[0.03] text-fg-tertiary transition-colors hover:border-charge/40 hover:text-fg">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="token" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-6" />
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onImage} />
          </label>
          <div className="text-xs text-fg-tertiary">
            {image ? "Image attached." : "PNG/JPG, under ~1.5 MB."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="soc-x">Twitter / X <span className="text-fg-tertiary">(optional)</span></Label>
          <div className="mt-2 flex items-center gap-2">
            <Twitter className="size-4 text-fg-tertiary" />
            <Input
              id="soc-x"
              value={socials.twitter}
              onChange={(e) =>
                setSocials((s) => ({ ...s, twitter: e.target.value }))
              }
              placeholder="@handle"
              className="flex-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="soc-tg">Telegram <span className="text-fg-tertiary">(optional)</span></Label>
          <div className="mt-2 flex items-center gap-2">
            <Send className="size-4 text-fg-tertiary" />
            <Input
              id="soc-tg"
              value={socials.telegram}
              onChange={(e) =>
                setSocials((s) => ({ ...s, telegram: e.target.value }))
              }
              placeholder="t.me/…"
              className="flex-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="soc-web">Website <span className="text-fg-tertiary">(optional)</span></Label>
          <div className="mt-2 flex items-center gap-2">
            <Globe className="size-4 text-fg-tertiary" />
            <Input
              id="soc-web"
              value={socials.website}
              onChange={(e) =>
                setSocials((s) => ({ ...s, website: e.target.value }))
              }
              placeholder="https://"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <Card className="space-y-1 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-fg">Mintable</p>
            <p className="text-xs text-fg-tertiary">
              Owner can create new supply. Risky — shown in red on the token page.
            </p>
          </div>
          <Switch checked={mintable} onCheckedChange={setMintable} />
        </div>
        <div className="flex items-center justify-between border-t border-fg/[0.06] pt-3">
          <div>
            <p className="text-sm font-medium text-fg">Burnable</p>
            <p className="text-xs text-fg-tertiary">
              Holders can burn their own tokens to reduce supply.
            </p>
          </div>
          <Switch checked={burnable} onCheckedChange={setBurnable} />
        </div>
      </Card>

      <div>
        <Label htmlFor="seed-usdc">
          Initial USDC liquidity <span className="text-fg-tertiary">(optional)</span>
        </Label>
        <div className="mt-2 flex items-center gap-2">
          <Flame className="size-4 text-fg-tertiary" />
          <Input
            id="seed-usdc"
            value={seedUsdc}
            onChange={(e) => setSeedUsdc(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="10"
            inputMode="decimal"
            className="flex-1 tabular-nums"
          />
          <span className="text-sm text-fg-secondary">USDC</span>
        </div>
        <p className="mt-1.5 text-xs text-fg-tertiary">
          Seeds a USDC pool on the Arc AMM so anyone can buy immediately. Leave
          empty to deploy only.
        </p>
      </div>

      {touched && !validation.ok && (
        <StatusLine tone="warning">{validation.error}</StatusLine>
      )}

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-charge" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-fg">Security guarantees</p>
            <ul className="mt-1.5 space-y-1 text-fg-secondary">
              <li>Deployed from your wallet — Charge holds no keys.</li>
              <li>
                {mintable || burnable
                  ? "Mint/Burn enabled per your selection — surfaced on the token page."
                  : "No mint, no burn — supply is fixed forever."}
              </li>
              <li>Arc-native USDC paired liquidity via Circle&apos;s USDC.</li>
            </ul>
          </div>
        </div>
      </Card>

      {balance.nativeRaw === 0n && !balance.isLoading && (
        <StatusLine tone="warning">
          You need native USDC to pay the deployment fee.
        </StatusLine>
      )}

      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {phase === "pending" && (
        <StatusLine>Deploying your contract to Arc…</StatusLine>
      )}
      {phase === "seeding" && (
        <StatusLine>Seeding the USDC liquidity pool…</StatusLine>
      )}

      <Button
        type="submit"
        size="xl"
        block
        loading={busy}
        disabled={!canSubmit}
      >
        {phase === "signing" ? (
          "Confirm in your wallet…"
        ) : phase === "pending" ? (
          "Deploying…"
        ) : phase === "seeding" ? (
          "Seeding pool…"
        ) : (
          <>
            <Coins className="size-4" aria-hidden />
            Launch token
          </>
        )}
      </Button>
    </form>
  );
}
