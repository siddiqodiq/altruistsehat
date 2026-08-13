import { expect, test } from "@playwright/test";
import {
  adminAuthorizationFailure,
  type AuthRole,
} from "../../src/lib/auth/admin";

async function json(response: Response) {
  return response.json() as Promise<{ error?: string; message: string; success: boolean }>;
}

test("adminAuthorizationFailure returns 401 when no session exists", async () => {
  const response = adminAuthorizationFailure(null);

  expect(response?.status).toBe(401);
  await expect(json(response as Response)).resolves.toMatchObject({
    error: "Login required.",
    message: "Login required.",
    success: false,
  });
});

test("adminAuthorizationFailure returns 403 for non-admin users", async () => {
  const response = adminAuthorizationFailure("user");

  expect(response?.status).toBe(403);
  await expect(json(response as Response)).resolves.toMatchObject({
    error: "Admin access required.",
    message: "Admin access required.",
    success: false,
  });
});

test("adminAuthorizationFailure allows admin users", () => {
  expect(adminAuthorizationFailure("admin" satisfies AuthRole)).toBeUndefined();
});
