import { existsSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import chromium from "@sparticuz/chromium-min";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { createExportJob, deleteExportJob } from "@/lib/leaderboard/export-jobs";
import { ExportRequestSchema } from "@/lib/leaderboard/schema";
import { OUTPUT_DIMENSIONS } from "@/lib/leaderboard/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXPORT_TIMEOUT_MS = 30_000;
const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";
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

function localPlaywrightChromiumCandidates() {
  const cacheRoot =
    platform() === "darwin"
      ? join(homedir(), "Library", "Caches", "ms-playwright")
      : join(homedir(), ".cache", "ms-playwright");

  if (!existsSync(cacheRoot)) {
    return [];
  }

  const browserDirs = readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  return browserDirs.flatMap((browserDir) => {
    const basePath = join(cacheRoot, browserDir);

    if (platform() === "darwin") {
      return [
        join(basePath, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
        join(basePath, "chrome-mac", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
      ];
    }

    if (platform() === "win32") {
      return [join(basePath, "chrome-win", "chrome.exe")];
    }

    return [join(basePath, "chrome-linux", "chrome")];
  });
}

function localChromiumExecutablePath() {
  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    ...localPlaywrightChromiumCandidates(),
  ];

  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));
}

async function launchExportBrowser(dimensions: (typeof OUTPUT_DIMENSIONS)[keyof typeof OUTPUT_DIMENSIONS]): Promise<Browser> {
  const viewport = {
    deviceScaleFactor: 1,
    height: dimensions.height,
    width: dimensions.width,
  };

  if (process.env.VERCEL) {
    const executablePath = await chromium.executablePath(process.env.CHROMIUM_PACK_URL ?? DEFAULT_CHROMIUM_PACK_URL);

    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      defaultViewport: viewport,
      executablePath,
      headless: "shell",
    });
  }

  const executablePath = localChromiumExecutablePath();

  return puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    channel: executablePath ? undefined : "chrome",
    defaultViewport: viewport,
    executablePath,
    headless: true,
  });
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
  let browser: Browser | undefined;

  try {
    exportLog("browser.launch", { format, jobId });
    browser = await launchExportBrowser(dimensions);
    exportLog("browser.newPage", { width: dimensions.width, height: dimensions.height });
    const page = await browser.newPage();
    page.setDefaultTimeout(EXPORT_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(EXPORT_TIMEOUT_MS);
    const url = new URL(`/render/${jobId}`, request.nextUrl.origin);
    url.searchParams.set("format", format);

    exportLog("page.goto", { url: url.toString() });
    await page.goto(url.toString(), { timeout: EXPORT_TIMEOUT_MS, waitUntil: "networkidle0" });
    exportLog("page.waitForSelector");
    await page.waitForSelector('[data-export-ready="true"]', { timeout: EXPORT_TIMEOUT_MS });
    exportLog("page.hideNextDevIndicators");
    await hideNextDevIndicators(page);
    exportLog("page.screenshot");
    const frame = await page.waitForSelector("[data-export-frame]", { timeout: EXPORT_TIMEOUT_MS });

    if (!frame) {
      throw new Error("Export frame was not found");
    }

    const buffer = await frame.screenshot({ type: "png" });
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
