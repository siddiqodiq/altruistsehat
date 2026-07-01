import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function source(pathname: string) {
  return fs.readFileSync(path.join(process.cwd(), pathname), "utf8");
}

test("athlete photo download API streams only stored athlete photo URLs as attachments", () => {
  const routeSource = source("src/app/api/athletes/[id]/photo/route.ts");
  const clientSource = source("src/lib/athletes/api.ts");

  expect(routeSource).toContain("PhotoKindSchema");
  expect(routeSource).toContain("athletePhotoUrlForKind");
  expect(routeSource).toContain("athletePhotoFilename");
  expect(routeSource).toContain("Content-Disposition");
  expect(routeSource).toContain("attachment");
  expect(routeSource).toContain("fetch(photoUrl");
  expect(routeSource).toContain("profile_photo_url,podium_photo_url");

  expect(clientSource).toContain("downloadAthletePhoto");
  expect(clientSource).toContain("/photo?kind=");
  expect(clientSource).toContain("URL.createObjectURL");
  expect(clientSource).toContain("download =");
});
