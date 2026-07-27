import assert from "node:assert/strict";
import test from "node:test";
import {
  addYearsIso,
  defaultDueDateForCadence,
  deriveCadenceFromPeriod,
  deriveComplianceAreaFromType,
  isRetentionLocked,
} from "./compliance-policy";

test("addYearsIso returns a +3 year timestamp by default", () => {
  const base = "2026-02-13T00:00:00.000Z";
  const result = addYearsIso(base);
  assert.equal(result.slice(0, 10), "2029-02-13");
});

test("isRetentionLocked protects records until retention date passes", () => {
  const now = new Date("2026-02-13T00:00:00.000Z");
  assert.equal(isRetentionLocked("2026-02-14T00:00:00.000Z", now), true);
  assert.equal(isRetentionLocked("2026-02-12T23:59:59.000Z", now), false);
  assert.equal(isRetentionLocked(null, now), true);
});

test("deriveComplianceAreaFromType maps common regulatory keywords", () => {
  assert.equal(deriveComplianceAreaFromType("COLA submission"), "COLA Labeling");
  assert.equal(deriveComplianceAreaFromType("Federal excise tax"), "Excise Tax");
  assert.equal(deriveComplianceAreaFromType("NYC fire inspection"), "Safety");
});

test("deriveCadenceFromPeriod infers filing cadence", () => {
  assert.equal(deriveCadenceFromPeriod("2026-01-01", "2026-01-15"), "Semi-Monthly");
  assert.equal(deriveCadenceFromPeriod("2026-01-01", "2026-01-31"), "Monthly");
  assert.equal(deriveCadenceFromPeriod("2026-01-01", "2026-03-31"), "Quarterly");
  assert.equal(deriveCadenceFromPeriod("2026-01-01", "2026-12-31"), "Annual");
});

test("defaultDueDateForCadence applies expected offsets", () => {
  assert.equal(defaultDueDateForCadence("2026-01-31", "Monthly"), "2026-02-14");
  assert.equal(defaultDueDateForCadence("2026-03-31", "Quarterly"), "2026-04-30");
});
