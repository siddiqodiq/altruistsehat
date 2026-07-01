import { timingSafeEqual } from "node:crypto";
import { TEMPORARY_DEV_ADMIN_TOKEN } from "./admin-management";
import { GLOBAL_LEADERBOARD_CLIENT_ID } from "./constants";

export { GLOBAL_LEADERBOARD_CLIENT_ID };

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireLeaderboardAdmin(request: Request): Response | undefined {
  const configuredToken = TEMPORARY_DEV_ADMIN_TOKEN;

  if (!secureCompare(bearerToken(request), configuredToken)) {
    return Response.json(
      {
        success: false,
        message: "Invalid admin token.",
      },
      { status: 401 },
    );
  }

  return undefined;
}
