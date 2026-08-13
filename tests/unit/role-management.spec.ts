import { expect, test } from "@playwright/test";
import {
  roleChangeAuthorizationFailure,
  type RoleChangeRequest,
} from "../../src/lib/auth/role-management";

const baseRequest: RoleChangeRequest = {
  adminCount: 2,
  currentAuthUserId: "auth-admin",
  currentRole: "admin",
  targetAuthUserId: "auth-target",
  targetCurrentRole: "user",
  targetRole: "admin",
};

test("role management blocks missing auth links", () => {
  expect(roleChangeAuthorizationFailure({ ...baseRequest, targetAuthUserId: null })?.status).toBe(409);
});

test("role management blocks self-demotion", () => {
  expect(
    roleChangeAuthorizationFailure({
      ...baseRequest,
      currentAuthUserId: "auth-admin",
      targetAuthUserId: "auth-admin",
      targetCurrentRole: "admin",
      targetRole: "user",
    })?.status,
  ).toBe(409);
});

test("role management blocks demoting the last admin", () => {
  expect(
    roleChangeAuthorizationFailure({
      ...baseRequest,
      adminCount: 1,
      targetCurrentRole: "admin",
      targetRole: "user",
    })?.status,
  ).toBe(409);
});

test("role management allows an admin to promote or demote other linked athletes", () => {
  expect(roleChangeAuthorizationFailure(baseRequest)).toBeUndefined();
  expect(roleChangeAuthorizationFailure({ ...baseRequest, targetCurrentRole: "admin", targetRole: "user" })).toBeUndefined();
});
