import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function accountRouteSource() {
  return fs.readFileSync(path.join(process.cwd(), "src/app/api/athletes/[id]/account/route.ts"), "utf8");
}

test("athlete account route uses admin auth and Supabase Auth account updates", () => {
  const source = accountRouteSource();

  expect(source).toContain("requireAdminAuth");
  expect(source).toContain("updateUserById");
  expect(source).toContain("authEmailForUsername");
  expect(source).toContain("duplicateUsernameMessage");
  expect(source).toContain("athleteAuthUpdateAttributes");
  expect(source).toContain("athletePasswordResetAttributes");
});

test("athlete account route does not return or persist plaintext passwords", () => {
  const source = accountRouteSource();
  const responseStart = source.lastIndexOf("return NextResponse.json");
  const responseBlock = source.slice(responseStart);

  expect(source).not.toContain("localStorage");
  expect(source).not.toContain("sessionStorage");
  expect(responseBlock).not.toContain("password");
  expect(responseBlock).toContain("mapAthleteRow");
});
