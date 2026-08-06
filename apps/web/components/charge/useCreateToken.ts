"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TokenFormData {
  name: string;
  symbol: string;
  supply: string;
  decimals: string;
  mintable: boolean;
  burnable: boolean;
  pausable: boolean;
  chain: string;
}

export type DeployStatus =
  | "idle"
  | "deploying"
  | "checking"
  | "deployed"
  | "error";

export interface DeployResult {
  contractId?: string;
  contractAddress?: string;
  transactionId?: string;
  deploymentStatus?: string;
}

export interface UseCreateTokenReturn {
  status: DeployStatus;
  result: DeployResult | null;
  error: string | null;
  isChecking: boolean;
  isDeploying: boolean;
  canDeploy: boolean;
  deployToken: (data: TokenFormData) => Promise<void>;
  reset: () => void;
}

const DEPLOYMENT_POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLL_ATTEMPTS = 40; // 2 minutes max

export function useCreateToken(): UseCreateTokenReturn {
  const [status, setStatus] = useState<DeployStatus>("idle");
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const pollAttempts = useRef(0);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const isDeploying = status === "deploying" || status === "checking";
  const canDeploy = status === "idle" || status === "error" || status === "deployed";

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setIsChecking(false);
    pollAttempts.current = 0;
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const pollDeployment = useCallback(
    async (contractId: string) => {
      try {
        const res = await fetch(`/api/token/deployment/${contractId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to check deployment status");
        }

        const deployment = data.data;
        const depStatus = deployment?.deploymentStatus;

        setResult((prev) => ({
          ...prev!,
          deploymentStatus: depStatus,
          contractAddress: deployment?.contractAddress,
        }));

        if (depStatus === "COMPLETED" || depStatus === "SUCCEEDED") {
          setStatus("deployed");
          setIsChecking(false);
          if (pollTimer.current) {
            clearTimeout(pollTimer.current);
          }
          return;
        }

        if (depStatus === "FAILED" || depStatus === "ERROR") {
          throw new Error(deployment?.deploymentErrorReason || "Deployment failed");
        }

        // Still pending - continue polling
        pollAttempts.current++;
        if (pollAttempts.current >= MAX_POLL_ATTEMPTS) {
          throw new Error("Deployment timed out. Check Circle dashboard for status.");
        }

        pollTimer.current = setTimeout(() => pollDeployment(contractId), DEPLOYMENT_POLL_INTERVAL);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Deployment check failed");
        setStatus("error");
        setIsChecking(false);
        if (pollTimer.current) {
          clearTimeout(pollTimer.current);
        }
      }
    },
    [],
  );

  const deployToken = useCallback(
    async (data: TokenFormData) => {
      setError(null);
      setResult(null);
      setStatus("deploying");
      pollAttempts.current = 0;

      try {
        // Call Next.js API route (not backend directly) - it handles walletId server-side
        const deployPayload = {
          name: data.name.trim(),
          symbol: data.symbol.trim().toUpperCase(),
          decimals: parseInt(data.decimals, 10) || 18,
          supply: data.supply.replace(/,/g, "") || "0",
          mintable: data.mintable,
          burnable: data.burnable,
          pausable: data.pausable,
          chain: data.chain,
        };

        const res = await fetch("/api/token/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deployPayload),
        });

        const deployData = await res.json();

        if (!res.ok) {
          throw new Error(deployData.error?.message || "Deployment request failed");
        }

        const contractId = deployData.contractId;
        const transactionId = deployData.transactionId;

        if (!contractId) {
          throw new Error("No contract ID returned from deployment");
        }

        setResult({
          contractId,
          transactionId,
        });

        // Start polling for deployment status
        setStatus("checking");
        setIsChecking(true);
        await pollDeployment(contractId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Deployment failed";
        setError(msg);
        setStatus("error");
        setIsChecking(false);
      }
    },
    [pollDeployment],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
      }
    };
  }, []);

  return {
    status,
    result,
    error,
    isChecking,
    isDeploying,
    canDeploy,
    deployToken,
    reset,
  };
}