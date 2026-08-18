import { expect, test } from "@playwright/test";
import { parseCsvInput, parseJsonInput } from "../../src/lib/leaderboard/importers";

test("time minute CSV without a header imports athlete values as minutes", () => {
  const athletes = parseCsvInput("Fikri NA,550\nFarid Akbar,50", "time_minutes");

  expect(athletes.map(({ name, value }) => ({ name, value }))).toEqual([
    { name: "Fikri NA", value: 550 },
    { name: "Farid Akbar", value: 50 },
  ]);
});

test("time minute CSV accepts time and minutes headers", () => {
  expect(parseCsvInput("name,time\nFikri NA,550", "time_minutes")[0]).toMatchObject({
    name: "Fikri NA",
    value: 550,
  });
  expect(parseCsvInput("name,minutes\nFarid Akbar,50", "time_minutes")[0]).toMatchObject({
    name: "Farid Akbar",
    value: 50,
  });
});

test("time minute JSON imports the time field as minutes", () => {
  const athletes = parseJsonInput('[{ "name": "Fikri NA", "time": 550 }]', "time_minutes");

  expect(athletes[0]).toMatchObject({
    name: "Fikri NA",
    value: 550,
  });
});

test("elevation gain import accepts common meter headers from CSV and JSON", () => {
  expect(parseCsvInput("name,elevation\nUtha,1.250 m", "elevation_m")[0]).toMatchObject({
    name: "Utha",
    value: 1250,
  });
  expect(parseCsvInput("name,elevation gain\nAndi,980", "elevation_m")[0]).toMatchObject({
    name: "Andi",
    value: 980,
  });
  expect(parseCsvInput("name,gain\nBudi,1,050", "elevation_m")[0]).toMatchObject({
    name: "Budi",
    value: 1050,
  });
  expect(parseCsvInput("name,meters\nCitra,725", "elevation_m")[0]).toMatchObject({
    name: "Citra",
    value: 725,
  });
  expect(parseJsonInput('[{ "name": "Dewi", "elevation gain": "1,250" }]', "elevation_m")[0]).toMatchObject({
    name: "Dewi",
    value: 1250,
  });
});

test("time minute import rejects non-integer minute formats", () => {
  for (const invalidValue of ["8h 30m", "08:30", "90.5", "90 minutes", "-1"]) {
    expect(() => parseCsvInput(`Fikri NA,${invalidValue}`, "time_minutes")).toThrow(
      "Time must be a whole number of minutes.",
    );
  }
});
