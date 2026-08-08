"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

/**
 * Scan a barcode with the device camera.
 *
 * Web POS has always needed a USB scanner, which works because such scanners
 * behave as keyboards and type into the search box. That leaves anyone on a
 * laptop or tablet with no scanner unable to scan at all.
 *
 * Uses the browser's own `BarcodeDetector`. There is deliberately no bundled
 * decoder fallback: a WASM decoder is roughly a megabyte, and the browsers
 * that lack `BarcodeDetector` are largely desktop Safari and Firefox, where a
 * USB scanner is the normal answer anyway. Where it is missing we say so
 * plainly rather than opening a camera that will never match anything.
 */

/** Minimal shape of the BarcodeDetector API, which TypeScript has no lib for. */
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

/** Formats an Indian shop actually uses on packaged and own-label goods. */
const FORMATS = ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39"];

export function isCameraScanSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function CameraScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Guards against firing twice for one scan: a barcode stays in frame for
  // many animation frames after the first match.
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!isCameraScanSupported()) {
        setError(
          "This browser cannot scan with the camera. Use a USB barcode scanner, or open the counter app.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // The rear camera is the one pointed at the goods.
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
          .BarcodeDetector;
        const detector = new Ctor({ formats: FORMATS });

        const tick = async () => {
          if (cancelled || doneRef.current || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            const value = found[0]?.rawValue?.trim();
            if (value) {
              doneRef.current = true;
              stop();
              onDetected(value);
              return;
            }
          } catch {
            // A single failed frame is normal — motion blur, bad focus.
            // Keep looking rather than tearing the camera down.
          }
          rafRef.current = requestAnimationFrame(() => void tick());
        };

        rafRef.current = requestAnimationFrame(() => void tick());
      } catch (err) {
        const name = (err as { name?: string })?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site, then try again."
            : "Could not start the camera. Check that no other app is using it.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [onDetected, stop]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scan a barcode"
    >
      <div className="w-full max-w-sm rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
            Scan a barcode
          </h2>
          <button
            type="button"
            onClick={() => {
              stop();
              onClose();
            }}
            aria-label="Close scanner"
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error ? (
          <p className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3 text-xs font-bold text-[var(--warning-strong)]">
            {error}
          </p>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3]">
              {/* muted + playsInline are required or iOS refuses to autoplay. */}
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--primary)]/80" />
            </div>
            <p className="mt-3 text-[11px] font-semibold text-[var(--text-secondary)]">
              Hold the barcode inside the frame. It adds to the cart as soon as
              it reads.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Button that opens the scanner, rendered only where scanning can work. */
export function CameraScanButton({
  onDetected,
}: {
  onDetected: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);

  // Checked after mount: the server has no `window`, and rendering the button
  // during SSR then removing it would be a hydration mismatch.
  useEffect(() => setSupported(isCameraScanSupported()), []);

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-extrabold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)]"
      >
        <Camera className="w-4 h-4" />
        Scan
      </button>
      {open && (
        <CameraScanner
          onDetected={(code) => {
            setOpen(false);
            onDetected(code);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
