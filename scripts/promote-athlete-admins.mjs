#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const DEFAULT_AUTH_USERNAME_EMAIL_DOMAIN = "users.altruistsehat.local";
const ADMIN_USERNAMES = ["marutha.wira", "siddiq.odiq", "ghaly.arkan", "rakha.maulana"];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function authEmailForUsername(username, domain) {
  return `${username}@${domain}`;
}

async function listAuthUsers(supabase) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }

    users.push(...(data?.users ?? []));
    if ((data?.users ?? []).length < 1000) {
      break;
    }
    page += 1;
  }

  return users;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const emailDomain = process.env.AUTH_USERNAME_EMAIL_DOMAIN?.trim() || DEFAULT_AUTH_USERNAME_EMAIL_DOMAIN;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: athletes, error: athleteError } = await supabase
    .from("athletes")
    .select("id,name,username,auth_user_id")
    .in("username", ADMIN_USERNAMES);

  if (athleteError) {
    throw athleteError;
  }

  const athletesByUsername = new Map((athletes ?? []).map((athlete) => [athlete.username, athlete]));
  const missing = ADMIN_USERNAMES.filter((username) => !athletesByUsername.has(username));
  if (missing.length) {
    throw new Error(`Admin athlete username not found: ${missing.join(", ")}`);
  }

  const usersById = new Map((await listAuthUsers(supabase)).map((user) => [user.id, user]));
  for (const username of ADMIN_USERNAMES) {
    const athlete = athletesByUsername.get(username);
    if (!athlete.auth_user_id) {
      throw new Error(`${username} is missing auth_user_id.`);
    }

    const authUser = usersById.get(athlete.auth_user_id);
    if (!authUser) {
      throw new Error(`${username} auth user was not found.`);
    }

    const { error } = await supabase.auth.admin.updateUserById(athlete.auth_user_id, {
      app_metadata: {
        ...(authUser.app_metadata ?? {}),
        role: "admin",
      },
    });

    if (error) {
      throw error;
    }

    console.log(`Promoted ${username} (${athlete.name}) to admin.`);
  }

  const bootstrapEmail = authEmailForUsername("admin", emailDomain);
  const afterPromoteUsers = await listAuthUsers(supabase);
  const bootstrapUser = afterPromoteUsers.find((user) => user.email === bootstrapEmail);
  if (bootstrapUser) {
    const { error } = await supabase.auth.admin.deleteUser(bootstrapUser.id);
    if (error) {
      throw error;
    }
    console.log(`Deleted bootstrap admin user ${bootstrapEmail}.`);
  } else {
    console.log(`Bootstrap admin user ${bootstrapEmail} was already absent.`);
  }

  const finalUsersById = new Map((await listAuthUsers(supabase)).map((user) => [user.id, user]));
  const failed = [];
  for (const username of ADMIN_USERNAMES) {
    const athlete = athletesByUsername.get(username);
    const user = finalUsersById.get(athlete.auth_user_id);
    if (user?.app_metadata?.role !== "admin") {
      failed.push(username);
    }
  }

  const finalBootstrap = Array.from(finalUsersById.values()).find((user) => user.email === bootstrapEmail);
  if (failed.length || finalBootstrap) {
    throw new Error(`Verification failed. Failed admins: ${failed.join(", ") || "none"}. Bootstrap present: ${Boolean(finalBootstrap)}.`);
  }

  console.log("Role promotion verified.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
