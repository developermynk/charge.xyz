"use client";

import jsQR from "jsqr";
import { Camera, RefreshCw, X } from "lucide-react";
import * as React from "react";

import { Button, Modal } from "@charge/ui";

/**
 * QR scanner modal.
 *
 * Professional two-step flow (matches Coinbase / Uniswap / Binance):
 *   1. A pre-prompt card explains WHY camera access is needed and shows an
 *      "Enable camera" button. We do NOT call getUserMedia until the user
 *      taps it — so the browser's native Allow/Deny appears in context.
 *   2. On tap we open the camera with the native getUserMedia API and decode
 *      frames with jsQR in a requestAnimationFrame loop. This is far more
 *      reliable on mobile than html5-qrcode's auto-decode, which silently
 *      fails to match on many phones even with a valid qrbox.
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
  const [phase, setPhase] = React.useState<
    "prompt" | "starting" | "live" | "error"
  >("prompt");
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState("");

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const stop = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
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
              "Camera is blocked for this site. Open your browser's site settings and set Camera to Allow, then tap “Try camera again”. Or enter the address manually below.",
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
    setError(null);
    setPhase("starting");
  }, []);

  // Open the camera after the "starting" phase renders the <video> element.
  React.useEffect(() => {
    if (phase !== "starting") return;

    let cancelled = false;

    const secure =
      typeof window !== "undefined" &&
      (window.isSecureContext ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1");

    if (!secure) {
      setError(
        "Camera needs HTTPS. Open the app over https (or localhost) to scan, or enter the address manually below.",
      );
      setPhase("error");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setError("Scanner failed to initialize. Enter the address manually below.");
      setPhase("error");
      return;
    }

    // Robust camera selection: exact back → any back → front.
    const attempts: MediaTrackConstraints[] = [
      { facingMode: { exact: "environment" } },
      { facingMode: "environment" },
      { facingMode: "user" },
    ];

    (async () => {
      let stream: MediaStream | null = null;
      let lastErr = "";

      for (const cfg of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: cfg });
          break;
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          lastErr = m;
          const ml = m.toLowerCase();
          // constraint / device errors → try next camera config
          if (/overconstrained|notfound|notreadable|nodet|not a cam/i.test(ml)) {
            continue;
          }
          // permission / insecure / other hard error → surface and stop
          setError(diagnoseCameraError(ml));
          setPhase("error");
          return;
        }
      }

      if (!stream) {
        setError(
          lastErr
            ? diagnoseCameraError(lastErr)
            : "No camera is available on this device, or it is in use by another app. Enter the address manually below.",
        );
        setPhase("error");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;

      try {
        await video.play();
      } catch {
        /* some browsers need a tick; the loop checks readyState anyway */
      }

      setPhase("live");

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setError("Scanner could not start. Enter the address manually below.");
        setPhase("error");
        return;
      }

      const tick = () => {
        if (cancelled) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const w = video.videoWidth;
          const h = video.videoHeight;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          let data: ImageData | null = null;
          try {
            data = ctx.getImageData(0, 0, w, h);
          } catch {
            /* tainted frame — skip */
          }
          if (data) {
            const found = jsQR(data.data, data.width, data.height);
            if (found?.data) {
              stop();
              onResult(found.data);
              onClose();
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
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
          <div className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black/40">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
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

        {phase === "live" && (
          <p className="text-center text-sm text-fg-secondary">
            Point your camera at a wallet QR code.
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
