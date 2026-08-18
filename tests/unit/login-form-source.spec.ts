import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("login form uses a generic username placeholder", () => {
  const loginForm = source("src/components/auth/LoginForm.tsx");

  expect(loginForm).toMatch(/name="username"[\s\S]*placeholder="user\.name"/);
  expect(loginForm).not.toContain('placeholder="marutha.wira"');
});
