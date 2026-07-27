import assert from "node:assert/strict";
import test from "node:test";
import { isRoleAuthorized } from "./authorization-policy";

test("authz matrix: admin can manage users", () => {
  assert.equal(isRoleAuthorized("admin", "users", "write"), true);
  assert.equal(isRoleAuthorized("admin", "users", "delete"), true);
});

test("authz matrix: compliance can manage compliance records and reports", () => {
  assert.equal(isRoleAuthorized("compliance", "complianceRecords", "write"), true);
  assert.equal(isRoleAuthorized("compliance", "ttbReports", "write"), true);
  assert.equal(isRoleAuthorized("compliance", "ttbReportApproval", "approve"), true);
});

test("authz matrix: sales can write sales orders but cannot approve reports", () => {
  assert.equal(isRoleAuthorized("sales", "salesOrders", "write"), true);
  assert.equal(isRoleAuthorized("sales", "ttbReportApproval", "approve"), false);
});

test("authz matrix: distiller can upload job photos but cannot write reports", () => {
  assert.equal(isRoleAuthorized("distiller", "jobPhotos", "upload"), true);
  assert.equal(isRoleAuthorized("distiller", "ttbReports", "write"), false);
});

test("authz matrix: unknown role context is denied", () => {
  assert.equal(isRoleAuthorized(undefined, "auditLogs", "read"), false);
});
