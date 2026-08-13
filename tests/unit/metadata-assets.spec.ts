import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function localMetadataImagePaths(layoutSource: string): string[] {
  const paths = new Set<string>();
  const localImagePattern = /["'](\/[^"']+\.(?:gif|jpe?g|png|svg|webp))["']/gi;
  let match: RegExpExecArray | null;

  while ((match = localImagePattern.exec(layoutSource))) {
    paths.add(match[1]);
  }

  return [...paths];
}

test("page metadata image paths point to existing public assets", () => {
  const metadataImages = localMetadataImagePaths(source("src/app/layout.tsx"));

  expect(metadataImages).not.toEqual([]);
  for (const imagePath of metadataImages) {
    expect(fs.existsSync(path.join(root, "public", imagePath)), `${imagePath} should exist in public/`).toBe(true);
  }
});
