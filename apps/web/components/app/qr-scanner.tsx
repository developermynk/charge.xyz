"use client";

import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import * as React from "react";

import { Button, Modal } from "@charge/ui";

/**
 * QR scanner modal. Opens the camera via getUserMedia (local only — the video
 * stream never leaves the browser) and decodes the first QR it sees, then
 * hands the decoded text back through `onResult`.
 *
 * Privacy/security: no frames are uploaded. The stream is stopped the moment
 * the modal closes.
 *
 * Camera access requires a secure context (https or localhost). If it is
 * unavailable for any reason (permission denied, no camera, unsupported
 * browser), we show an accurate message and fall back to manual entry so the
 * parent flow (e.g. Send) is never blocked.
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
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
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

  React.useEffect(() => {
    if (!open) return;
    // Guard against double-start on the same element (which re-fires the
    // camera permission prompt). The cleanup sets this false before any
    // legitimate re-open.
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    setError(null);
    setManual("");
    setStarting(true);

    // Gate on a secure context before touching getUserMedia. This gives an
    // accurate message instead of a cryptic browser rejection.
    const secure =
      typeof window !== "undefined" &&
      (window.isSecureContext ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1");

    if (!secure) {
      setError("Camera needs HTTPS. Use the app over https (or localhost) to scan, or enter the address manually below.");
      setStarting(false);
      return;
    }

    const scanner = new Html5Qrcode("qr-reader-region");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (cancelled) return;
          void stop();
          onResult(decoded);
          onClose();
        },
        () => {
          /* decode errors while scanning — ignore */
        },
      )
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(diagnoseCameraError(msg));
      })
      .finally(() => setStarting(false));

    return () => {
      cancelled = true;
      void stop();
    };
  }, [open, onClose, onResult, stop]);

  return (
    <Modal open={open} onClose={onClose} title="Scan a QR code">
      <div className="space-y-4">
        <div
          id="qr-reader-region"
          ref={regionRef}
          className="mx-auto min-h-[260px] w-full max-w-sm overflow-hidden rounded-2xl bg-black/40"
        />

        {starting && (
          <p className="text-center text-sm text-fg-secondary">Starting camera…</p>
        )}

        {error && (
          <div className="space-y-3">
            <p className="text-center text-sm text-danger">{error}</p>

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
    return "Camera permission was denied. Enable camera access for this site in your browser settings, or enter the address manually below.";
  }
  if (/notfound|not readable|nodet|no camera|devices?/i.test(m)) {
    return "No camera is available on this device, or it is in use by another app. Enter the address manually below.";
  }
  if (/secure|insecure|http/i.test(m)) {
    return "Camera needs HTTPS. Use the app over https (or localhost) to scan, or enter the address manually below.";
  }
  if (/notsupported|overconstrained|constraint/i.test(m)) {
    return "This camera isn't supported for scanning. Enter the address manually below.";
  }
  return "Could not start the camera. Enter the address manually below.";
}
