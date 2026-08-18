import { expect, test } from "@playwright/test";
import {
  athleteAuthCreateAttributes,
  athleteAuthUpdateAttributes,
  athletePasswordResetAttributes,
  duplicateUsernameMessage,
  findDuplicateUsernames,
  isDuplicateAuthUserError,
  normalizeAthleteAccountUsername,
  provisionAthleteUserAccounts,
} from "../../src/lib/athletes/accounts";

test("athleteAuthCreateAttributes creates user-role Supabase Auth accounts from athlete names", () => {
  expect(
    athleteAuthCreateAttributes({
      defaultPassword: "Password123!",
      emailDomain: "users.altruistsehat.local",
      name: "Marutha Wira Yuda",
      username: "marutha.wira",
    }),
  ).toEqual({
    app_metadata: { role: "user" },
    email: "marutha.wira@users.altruistsehat.local",
    email_confirm: true,
    password: "Password123!",
    user_metadata: {
      display_name: "Marutha Wira Yuda",
      username: "marutha.wira",
    },
  });
});

test("findDuplicateUsernames catches generated username collisions before provisioning", () => {
  expect(findDuplicateUsernames(["marutha.wira", "utha", "marutha.wira"])).toEqual(["marutha.wira"]);
  expect(findDuplicateUsernames(["marutha.wira", "utha"])).toEqual([]);
});

test("duplicateUsernameMessage gives the admin a concrete conflict to resolve", () => {
  expect(duplicateUsernameMessage(["marutha.wira", "utha"])).toBe(
    "Username sudah digunakan: marutha.wira, utha. Ubah nama atlet atau akun sebelum mencoba lagi.",
  );
});

test("normalizeAthleteAccountUsername follows the existing login username rule", () => {
  expect(normalizeAthleteAccountUsername("  Marutha Wira  ")).toBe("marutha.wira");
  expect(normalizeAthleteAccountUsername("@Marutha.Wira")).toBe("marutha.wira");
  expect(normalizeAthleteAccountUsername("")).toBe("");
});

test("athleteAuthUpdateAttributes changes login identity without touching role metadata", () => {
  expect(
    athleteAuthUpdateAttributes({
      emailDomain: "users.altruistsehat.local",
      name: "Marutha Wira Yuda",
      username: "marutha.wira",
    }),
  ).toEqual({
    email: "marutha.wira@users.altruistsehat.local",
    email_confirm: true,
    user_metadata: {
      display_name: "Marutha Wira Yuda",
      username: "marutha.wira",
    },
  });
});

test("athletePasswordResetAttributes only carries the new password", () => {
  expect(athletePasswordResetAttributes("Password123!")).toEqual({
    password: "Password123!",
  });
});

test("isDuplicateAuthUserError detects Supabase Auth duplicate user messages", () => {
  expect(isDuplicateAuthUserError(new Error("User already registered"))).toBe(true);
  expect(isDuplicateAuthUserError(new Error("Could not reach Supabase Auth"))).toBe(false);
});

test("provisionAthleteUserAccounts creates user accounts and returns auth IDs by username", async () => {
  const createdEmails: string[] = [];
  const supabase = {
    auth: {
      admin: {
        async createUser(attributes: { email: string }) {
          createdEmails.push(attributes.email);
          return { data: { user: { id: `auth-${createdEmails.length}` } }, error: null };
        },
        async deleteUser() {
          return { error: null };
        },
      },
    },
  };

  const result = await provisionAthleteUserAccounts(supabase, [
    { name: "Marutha Wira Yuda", username: "marutha.wira" },
    { name: "Utha", username: "utha" },
  ], {
    defaultPassword: "Password123!",
    emailDomain: "users.altruistsehat.local",
  });

  expect(createdEmails).toEqual(["marutha.wira@users.altruistsehat.local", "utha@users.altruistsehat.local"]);
  expect(result).toEqual(
    new Map([
      ["marutha.wira", "auth-1"],
      ["utha", "auth-2"],
    ]),
  );
});

test("provisionAthleteUserAccounts rolls back created auth users when a later account fails", async () => {
  const deletedUserIds: string[] = [];
  const supabase = {
    auth: {
      admin: {
        async createUser(attributes: { email: string }) {
          if (attributes.email === "utha@users.altruistsehat.local") {
            return { data: { user: null }, error: { message: "User already registered" } };
          }

          return { data: { user: { id: "auth-1" } }, error: null };
        },
        async deleteUser(id: string) {
          deletedUserIds.push(id);
          return { error: null };
        },
      },
    },
  };

  await expect(
    provisionAthleteUserAccounts(supabase, [
      { name: "Marutha Wira Yuda", username: "marutha.wira" },
      { name: "Utha", username: "utha" },
    ], {
      defaultPassword: "Password123!",
      emailDomain: "users.altruistsehat.local",
    }),
  ).rejects.toThrow("User already registered");

  expect(deletedUserIds).toEqual(["auth-1"]);
});
