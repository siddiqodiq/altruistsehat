import { chromium, type Page } from "playwright";
import { NextRequest } from "next/server";
import { createExportJob, deleteExportJob } from "@/lib/leaderboard/export-jobs";
import { ExportRequestSchema } from "@/lib/leaderboard/schema";
import { OUTPUT_DIMENSIONS } from "@/lib/leaderboard/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_TIMEOUT_MS = 30_000;
const NEXT_DEVTOOLS_HIDE_CSS = `
  nextjs-portal,
  [data-nextjs-dev-tools-button],
  [data-nextjs-devtools],
  [data-nextjs-build-indicator],
  [data-nextjs-toast],
  [data-nextjs-dialog-overlay],
  [data-nextjs-error-overlay],
  [data-nextjs-route-announcer] {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

function exportErrorResponse(message: string, error: unknown, status = 500) {
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown export error";
  console.error("PNG_EXPORT_FAILED", {
    message,
    error: detail,
    stack: error instanceof Error ? error.stack : undefined,
  });

  return Response.json(
    {
      success: false,
      message,
      error: detail,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function exportLog(step: string, meta?: Record<string, unknown>) {
  console.info("PNG_EXPORT_STEP", { step, ...meta });
}

async function hideNextDevIndicators(page: Page) {
  await page.addStyleTag({ content: NEXT_DEVTOOLS_HIDE_CSS });
  await page.evaluate(() => {
    document
      .querySelectorAll(
        [
          "nextjs-portal",
          "[data-nextjs-dev-tools-button]",
          "[data-nextjs-devtools]",
          "[data-nextjs-build-indicator]",
          "[data-nextjs-toast]",
          "[data-nextjs-dialog-overlay]",
          "[data-nextjs-error-overlay]",
        ].join(","),
      )
      .forEach((node) => node.remove());
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ExportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return exportErrorResponse("Invalid export request", parsed.error, 400);
  }

  const { format, spec } = parsed.data;
  const dimensions = OUTPUT_DIMENSIONS[format];
  const jobId = createExportJob(spec);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

  try {
    exportLog("browser.launch", { format, jobId });
    browser = await chromium.launch({ headless: true });
    exportLog("browser.newPage", { width: dimensions.width, height: dimensions.height });
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: dimensions,
    });
    page.setDefaultTimeout(EXPORT_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(EXPORT_TIMEOUT_MS);
    const url = new URL(`/render/${jobId}`, request.nextUrl.origin);
    url.searchParams.set("format", format);

    exportLog("page.goto", { url: url.toString() });
    await page.goto(url.toString(), { timeout: EXPORT_TIMEOUT_MS, waitUntil: "domcontentloaded" });
    exportLog("page.waitForLoadState");
    await page.waitForLoadState("networkidle", { timeout: EXPORT_TIMEOUT_MS });
    exportLog("page.waitForSelector");
    await page.waitForSelector('[data-export-ready="true"]', { timeout: EXPORT_TIMEOUT_MS });
    exportLog("page.hideNextDevIndicators");
    await hideNextDevIndicators(page);
    exportLog("page.screenshot");
    const buffer = await page.locator("[data-export-frame]").screenshot({
      animations: "disabled",
      timeout: EXPORT_TIMEOUT_MS,
      type: "png",
    });
    const filename = format === "story" ? "leaderboard-story.png" : "leaderboard-feed.png";

    const image = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(image).set(buffer);

    return new Response(image, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return exportErrorResponse("Failed to render leaderboard", error);
  } finally {
    deleteExportJob(jobId);
    await browser?.close();
  }
}
