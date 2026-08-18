#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const DEFAULT_AUTH_USERNAME_EMAIL_DOMAIN = "users.altruistsehat.local";

function normalizeAthleteName(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function deriveUsernameFromAthleteName(name) {
  return normalizeAthleteName(name).split(" ").filter(Boolean).slice(0, 2).join(".");
}

function authEmailForUsername(username, domain) {
  return `${normalizeAthleteName(username).replace(/\s+/g, ".")}@${domain}`;
}

function duplicateUsernameGroups(athletes) {
  const byUsername = new Map();
  athletes.forEach((athlete) => {
    const current = byUsername.get(athlete.username) ?? [];
    current.push(athlete);
    byUsername.set(athlete.username, current);
  });

  return Array.from(byUsername.entries())
    .filter(([, entries]) => entries.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function authAttributes({ defaultPassword, emailDomain, name, username }) {
  return {
    app_metadata: { role: "user" },
    email: authEmailForUsername(username, emailDomain),
    email_confirm: true,
    password: defaultPassword,
    user_metadata: {
      display_name: name,
      username,
    },
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const defaultPassword = requireEnv("ATHLETE_DEFAULT_PASSWORD");
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

  const { data, error } = await supabase
    .from("athletes")
    .select("id,name,username,auth_user_id")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  const athletes = (data ?? []).map((athlete) => ({
    authUserId: athlete.auth_user_id,
    id: athlete.id,
    name: athlete.name,
    username: athlete.username || deriveUsernameFromAthleteName(athlete.name),
  }));

  const invalid = athletes.filter((athlete) => !athlete.username);
  if (invalid.length) {
    console.error("Cannot derive usernames for:");
    invalid.forEach((athlete) => console.error(`- ${athlete.name} (${athlete.id})`));
    process.exitCode = 1;
    return;
  }

  const duplicateGroups = duplicateUsernameGroups(athletes);
  if (duplicateGroups.length) {
    console.error("Duplicate usernames found. Resolve these before backfill:");
    duplicateGroups.forEach(([username, entries]) => {
      const names = entries.map((athlete) => `${athlete.name} (${athlete.id})`).join(", ");
      console.error(`- ${username}: ${names}`);
    });
    process.exitCode = 1;
    return;
  }

  const pending = athletes.filter((athlete) => !athlete.authUserId || !data?.find((row) => row.id === athlete.id)?.username);
  const mode = apply ? "Apply" : "Dry run";
  console.log(`${mode}: ${pending.length} athlete account update(s) pending.`);

  pending.forEach((athlete) => {
    const action = athlete.authUserId ? "update existing auth user" : "create auth user";
    console.log(`- ${athlete.name}: ${athlete.username} (${authEmailForUsername(athlete.username, emailDomain)}) -> ${action}`);
  });

  if (!apply) {
    console.log("No changes written. Re-run with --apply to create/update accounts.");
    return;
  }

  const createdUserIds = [];
  for (const athlete of pending) {
    let authUserId = athlete.authUserId;
    const attributes = authAttributes({
      defaultPassword,
      emailDomain,
      name: athlete.name,
      username: athlete.username,
    });

    if (authUserId) {
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(authUserId, {
        app_metadata: attributes.app_metadata,
        email: attributes.email,
        user_metadata: attributes.user_metadata,
      });
      if (updateAuthError) {
        throw updateAuthError;
      }
    } else {
      const { data: createdUser, error: createAuthError } = await supabase.auth.admin.createUser(attributes);
      if (createAuthError) {
        throw createAuthError;
      }

      authUserId = createdUser.user?.id;
      if (!authUserId) {
        throw new Error(`Could not create auth user for ${athlete.name}.`);
      }
      createdUserIds.push(authUserId);
    }

    const { error: updateAthleteError } = await supabase
      .from("athletes")
      .update({
        auth_user_id: authUserId,
        username: athlete.username,
      })
      .eq("id", athlete.id);

    if (updateAthleteError) {
      if (!athlete.authUserId && authUserId) {
        await supabase.auth.admin.deleteUser(authUserId).catch(() => null);
      }
      throw updateAthleteError;
    }
  }

  console.log(`Backfill complete. Created ${createdUserIds.length} new auth user(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
