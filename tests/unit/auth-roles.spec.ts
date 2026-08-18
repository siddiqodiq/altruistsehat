import { expect, test } from "@playwright/test";
import {
  loginRedirectPathForRole,
  roleFromClaims,
  safeInternalRedirectPath,
} from "../../src/lib/auth/roles";

test("roleFromClaims trusts only app_metadata role values", () => {
  expect(roleFromClaims({ app_metadata: { role: "admin" } })).toBe("admin");
  expect(roleFromClaims({ app_metadata: { role: "user" } })).toBe("user");
  expect(roleFromClaims({ user_metadata: { role: "admin" } })).toBe("user");
  expect(roleFromClaims({ app_metadata: { role: "owner" } })).toBe("user");
  expect(roleFromClaims(null)).toBe("user");
});

test("safeInternalRedirectPath keeps admin relative paths and rejects external URLs", () => {
  expect(safeInternalRedirectPath("/admin?tab=athletes", "/")).toBe("/admin?tab=athletes");
  expect(safeInternalRedirectPath("https://example.com/admin", "/")).toBe("/");
  expect(safeInternalRedirectPath("//example.com/admin", "/")).toBe("/");
});

test("loginRedirectPathForRole routes admins to admin and users to the public page", () => {
  expect(loginRedirectPathForRole("admin", "/admin?tab=athletes")).toBe("/admin?tab=athletes");
  expect(loginRedirectPathForRole("admin")).toBe("/admin");
  expect(loginRedirectPathForRole("user", "/admin")).toBe("/");
});
