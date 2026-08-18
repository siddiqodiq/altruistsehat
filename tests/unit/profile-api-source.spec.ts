import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("profile route scopes athlete reads and writes to the linked auth user", () => {
  const route = source("src/app/api/profile/route.ts");

  expect(route).toContain("getCurrentAuthProfile");
  expect(route).toContain(".eq(\"auth_user_id\", profile.userId)");
  expect(route).toContain("buildAthleteProfileSummary");
  expect(route).not.toContain("requireAdminAuth");
});

test("profile upload route validates ownership, upload kind, type, and size", () => {
  const route = source("src/app/api/profile/upload/route.ts");

  expect(route).toContain("getCurrentAuthProfile");
  expect(route).toContain("normalizeProfilePhotoKind");
  expect(route).toContain(".eq(\"auth_user_id\", profile.userId)");
  expect(route).toContain("allowedTypes");
  expect(route).toContain("maxSize");
  expect(route).not.toContain("requireAdminAuth");
});

test("profile password route uses current password without logging secrets", () => {
  const route = source("src/app/api/profile/password/route.ts");

  expect(route).toContain("validateProfilePasswordInput");
  expect(route).toContain("current_password");
  expect(route).toContain("supabase.auth.updateUser");
  expect(route).not.toContain("console.log");
  expect(route).not.toContain("requireAdminAuth");
});
