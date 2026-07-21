import { toBlob } from "html-to-image";
import { OUTPUT_DIMENSIONS, type OutputFormat } from "./types";

const ASSET_TIMEOUT_MS = 15_000;

export function exportFilename(format: OutputFormat): string {
  return format === "story" ? "leaderboard-story.png" : "leaderboard-feed.png";
}

/**
 * The canvas is always mounted inside a CSS-scaled preview wrapper, so we capture the
 * inner `[data-export-frame]` node and force the real output dimensions instead of the
 * scaled bounding box html-to-image would otherwise measure.
 */
export function resolveExportFrame(container: HTMLElement | null): HTMLElement | null {
  return container?.querySelector<HTMLElement>("[data-export-frame]") ?? null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}

async function settledImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

/**
 * html-to-image serialises the DOM as-is, so anything still loading would be captured
 * blank. Waiting is best-effort: a photo that never resolves must not block the export.
 */
async function waitForFrameAssets(frame: HTMLElement) {
  const images = Array.from(frame.querySelectorAll("img"));

  await withTimeout(
    Promise.all([document.fonts?.ready, ...images.map(settledImage)]),
    ASSET_TIMEOUT_MS,
  );
}

/** Lets React commit and paint pending spec changes before the DOM is serialised. */
export function nextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function captureExportFrame(frame: HTMLElement, format: OutputFormat): Promise<Blob> {
  const { height, width } = OUTPUT_DIMENSIONS[format];
  await waitForFrameAssets(frame);

  const blob = await toBlob(frame, {
    cacheBust: true,
    height,
    // Matches the deviceScaleFactor the previous headless-Chromium export used.
    pixelRatio: 1,
    style: {
      margin: "0",
      transform: "none",
      transformOrigin: "top left",
    },
    width,
  });

  if (!blob) {
    throw new Error("Browser could not encode the poster PNG");
  }

  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadExportFrame(
  container: HTMLElement | null,
  format: OutputFormat,
): Promise<{ filename: string; size: number }> {
  const frame = resolveExportFrame(container);

  if (!frame) {
    throw new Error("Export preview is not ready yet");
  }

  const blob = await captureExportFrame(frame, format);
  const filename = exportFilename(format);
  downloadBlob(blob, filename);

  return { filename, size: blob.size };
}
