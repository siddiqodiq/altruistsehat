import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function heroSource() {
  return fs.readFileSync(path.join(process.cwd(), "src/components/Hero.tsx"), "utf8");
}

test("homepage hero renders without the sports community label above the headline", () => {
  const hero = heroSource();

  expect(hero).toContain("Sehat Hari Ini");
  expect(hero).not.toContain("Komunitas Olahraga");
});
