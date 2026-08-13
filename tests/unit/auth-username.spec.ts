import { expect, test } from "@playwright/test";
import {
  authEmailForUsername,
  deriveUsernameFromAthleteName,
  loginCredentialsFromFormData,
  normalizeLoginUsername,
} from "../../src/lib/auth/username";

test("deriveUsernameFromAthleteName uses the first two normalized name words", () => {
  expect(deriveUsernameFromAthleteName("Marutha Wira Yuda")).toBe("marutha.wira");
  expect(deriveUsernameFromAthleteName("Utha")).toBe("utha");
  expect(deriveUsernameFromAthleteName("  Mårútha   Wira-Yuda  ")).toBe("marutha.wira");
});

test("normalizeLoginUsername accepts typed username spacing but rejects empty names", () => {
  expect(normalizeLoginUsername("  Marutha.Wira  ")).toBe("marutha.wira");
  expect(normalizeLoginUsername("Marutha Wira")).toBe("marutha.wira");
  expect(normalizeLoginUsername("")).toBe("");
});

test("authEmailForUsername maps username login to a synthetic auth email", () => {
  expect(authEmailForUsername("marutha.wira", "users.altruistsehat.local")).toBe(
    "marutha.wira@users.altruistsehat.local",
  );
});

test("loginCredentialsFromFormData maps username form input to Supabase email credentials", () => {
  const formData = new FormData();
  formData.set("username", " Marutha Wira ");
  formData.set("password", "Password123!");

  expect(loginCredentialsFromFormData(formData, "users.altruistsehat.local")).toEqual({
    email: "marutha.wira@users.altruistsehat.local",
    password: "Password123!",
    username: "marutha.wira",
  });
});
