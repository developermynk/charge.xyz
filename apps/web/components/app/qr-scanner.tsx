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
 * Note: camera access requires a secure context. It works on `localhost` but
 * browsers block it on plain-HTTP LAN addresses (e.g. http://192.168.x.x).
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
  const regionRef = React.useRef<HTMLDivElement>(null);
  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  const stop = React.useCallback(async () => {
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

    let cancelled = false;
    setError(null);
    setStarting(true);

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
        setError(
          /notallowed|permission|secure|insecure|http/i.test(msg)
            ? "Camera blocked. Open the app on https or localhost to scan."
            : "Could not start the camera. Check permissions.",
        );
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
        {error && <p className="text-center text-sm text-danger">{error}</p>}
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
