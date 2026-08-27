"use client";

import { Html5Qrcode } from "html5-qrcode";
import { Camera, RefreshCw, X } from "lucide-react";
import * as React from "react";

import { Button, Modal } from "@charge/ui";

/**
 * QR scanner modal.
 *
 * Professional two-step flow (matches Coinbase / Uniswap / Binance):
 *   1. A pre-prompt card explains WHY camera access is needed and shows an
 *      "Enable camera" button. We do NOT call getUserMedia until the user
 *      taps it — so the browser's native Allow/Deny appears in context, not
 *      as a surprise the moment the modal opens.
 *   2. On tap we start the camera. Success → live viewfinder + scan.
 *      Failure (denied / no camera / insecure) → an accurate message plus a
 *      "Try camera again" button that re-attempts, so once the user fixes
 *      permission in their browser settings a single tap re-opens the camera.
 *      A manual-entry fallback is always available so Send is never blocked.
 *
 * Privacy/security: no frames leave the browser. The stream is stopped the
 * moment the modal closes or a code is found.
 */
export function QrScanner({
  open,
  onClose,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
}) {
  const [phase, setPhase] = React.useState<"prompt" | "starting" | "live" | "error">(
    "prompt",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState("");
  const regionRef = React.useRef<HTMLDivElement>(null);
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const startedRef = React.useRef(false);

  const stop = React.useCallback(async () => {
    startedRef.current = false;
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* already stopped */
    }
    scannerRef.current = null;
  }, []);

  // Reset to the pre-prompt state every time the modal opens; meanwhile
  // asynchronously check the camera permission so a "denied" (blocked) site
  // shows the right guidance immediately rather than failing silently.
  React.useEffect(() => {
    if (!open) return;
    setPhase("prompt");
    setError(null);
    setManual("");

    let cancelled = false;
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          if (status.state === "denied") {
            setError(
              "Camera is blocked for this site. Open Chrome's site settings (⋮ → Site settings → Camera) and set it to Allow, then tap “Try camera again”. Or enter the address manually below.",
            );
            setPhase("error");
          }
        })
        .catch(() => {
          /* permissions API unavailable — proceed normally */
        });
    }

    return () => {
      cancelled = true;
      void stop();
    };
  }, [open, stop]);

  const startCamera = React.useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    setError(null);
    setPhase("starting");
  }, [onClose, onResult, stop]);

  // Start the camera after the "starting" phase renders the qr-reader-region element
  React.useEffect(() => {
    if (phase !== "starting") return;

    let cancelled = false;

    const secure =
      typeof window !== "undefined" &&
      (window.isSecureContext ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1");

    if (!secure) {
      startedRef.current = false;
      setError(
        "Camera needs HTTPS. Open the app over https (or localhost) to scan, or enter the address manually below.",
      );
      setPhase("error");
      return;
    }

    const scanner = new Html5Qrcode("qr-reader-region");
    scannerRef.current = scanner;

    const onScan = (decoded: string) => {
      if (cancelled) return;
      void stop();
      onResult(decoded);
      onClose();
    };
    const onErr = () => {
      /* decode errors while scanning — ignore */
    };

    // Robust camera selection: try back camera, then any facing mode,
    // then the explicit device list. `exact: "environment"` throws
    // OverconstrainedError on many phones, so we MUST fall back instead
    // of dying — that was the bug keeping the scanner broken everywhere.
    (async () => {
      const attempts: Array<string | MediaTrackConstraints> = [
        { facingMode: { exact: "environment" } },
        { facingMode: "environment" },
        { facingMode: "user" },
      ];

      for (const cfg of attempts) {
        try {
          await scanner.start(
            cfg,
            { fps: 10, qrbox: { width: 240, height: 240 } },
            onScan,
            onErr,
          );
          if (!cancelled) setPhase("live");
          return;
        } catch (e) {
          await scanner.stop().catch(() => {});
          try {
            scanner.clear();
          } catch {
            /* ignore */
          }
          const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
          // constraint/device errors → try next camera config
          if (/overconstrained|notfound|notreadable|nodet|not a cam/i.test(m)) {
            continue;
          }
          // permission / insecure / other hard error → surface and stop
          startedRef.current = false;
          setError(diagnoseCameraError(m));
          setPhase("error");
          return;
        }
      }

      // All facingMode attempts failed — enumerate devices and pick one.
      try {
        const cams = await Html5Qrcode.getCameras();
        if (cams && cams.length > 0) {
          const found = cams.find((c) => /back|rear|environment/i.test(c.label));
          const back: { id: string; label: string } = found ?? cams[0]!;
          await scanner.start(
            back.id,
            { fps: 10, qrbox: { width: 240, height: 240 } },
            onScan,
            onErr,
          );
          if (!cancelled) setPhase("live");
          return;
        }
      } catch {
        /* fall through to error */
      }

      startedRef.current = false;
      setError(
        "No camera is available on this device, or it is in use by another app. Enter the address manually below.",
      );
      setPhase("error");
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, onClose, onResult, stop]);

  return (
    <Modal open={open} onClose={onClose} title="Scan a QR code">
      <div className="space-y-4">
        {/* Live viewfinder (only while starting/live). */}
        {phase !== "prompt" && phase !== "error" && (
          <div
            id="qr-reader-region"
            ref={regionRef}
            className="mx-auto min-h-[260px] w-full max-w-sm overflow-hidden rounded-2xl bg-black/40"
          />
        )}

        {/* Step 1 — smart pre-prompt (professional pattern). */}
        {phase === "prompt" && (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-charge/10 text-charge">
              <Camera className="size-7" aria-hidden />
            </div>
            <p className="text-sm text-fg-secondary">
              Allow camera access to scan a wallet QR code. We only use it to
              read the code — the video stays on your device.
            </p>
            <Button block size="lg" onClick={startCamera}>
              <Camera className="size-4" aria-hidden /> Enable camera
            </Button>
          </div>
        )}

        {phase === "starting" && (
          <p className="text-center text-sm text-fg-secondary">
            Starting camera… (allow access when your browser asks)
          </p>
        )}

        {/* Error + retry + manual fallback. */}
        {phase === "error" && (
          <div className="space-y-3">
            <p className="text-center text-sm text-danger">{error}</p>
            <Button block variant="secondary" onClick={startCamera}>
              <RefreshCw className="size-4" aria-hidden /> Try camera again
            </Button>
            <div className="rounded-xl border border-fg/10 p-3">
              <label className="mb-1.5 block text-xs text-fg-tertiary">
                Or enter the address manually
              </label>
              <div className="flex gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="0x… or ethereum:0x…"
                  className="min-w-0 flex-1 rounded-lg border border-fg/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-charge"
                />
                <Button
                  variant="secondary"
                  disabled={!manual.trim()}
                  onClick={() => {
                    onResult(manual.trim());
                    onClose();
                  }}
                >
                  Use
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <Button variant="secondary" onClick={onClose}>
            <X className="size-4" aria-hidden /> Cancel
          </Button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-fg-tertiary">
          <Camera className="size-3.5" aria-hidden />
          The camera feed stays on this device.
        </p>
      </div>
    </Modal>
  );
}

function diagnoseCameraError(msg: string): string {
  const m = msg.toLowerCase();
  if (/notallowed|permission|denied/i.test(m)) {
    return "Camera access was blocked. Tap “Try camera again”, then choose Allow in your browser. Or enter the address manually below.";
  }
  if (/notfound|not readable|nodet|no camera|devices?/i.test(m)) {
    return "No camera is available on this device, or it is in use by another app. Enter the address manually below.";
  }
  if (/secure|insecure|http/i.test(m)) {
    return "Camera needs HTTPS. Open the app over https (or localhost) to scan, or enter the address manually below.";
  }
  if (/notsupported|overconstrained|constraint/i.test(m)) {
    return "This camera isn't supported for scanning. Enter the address manually below.";
  }
  return "Could not start the camera. Enter the address manually below.";
}
