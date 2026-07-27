import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { authStorage } from "./auth-storage";
import { LoginRateLimiter, getLoginClientKey } from "./auth-rate-limit";
import { createCsrfToken, CSRF_HEADER_NAME, isCsrfTokenValid, shouldEnforceCsrf } from "./csrf-protection";
import {
  type PolicyAction,
  type PolicyResource,
  isRoleAuthorized,
} from "./authorization-policy";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ALLOWED_JOB_PHOTO_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_JOB_PHOTO_BYTES,
  assertAllowedUpload,
  extensionForMimeType,
  parseBase64DataUrl,
  sanitizeUploadFilename,
} from "./upload-validation";
import {
  insertJobSchema,
  insertClientSchema,
  insertPropertySchema,
  insertStaffSchema,
  insertComplianceSchema,
  insertInventoryItemSchema,
  insertInventoryLotSchema,
  insertInventoryMovementSchema,
  insertBarrelSchema,
  insertBarrelEventSchema,
  insertSalesOrderSchema,
  insertDistillingBatchRecordSchema,
  insertDistillingProductionRecordSchema,
  insertDistillingInventoryRecordSchema,
  insertCalculatorPresetSchema,
  calculationTypeSchema,
  loginSchema,
  insertUserSchema,
  updatePlatformConfigSchema,
  attachmentDocTypeSchema,
  ttbReportTypes,
} from "@shared/schema";
import type {
  Barrel,
  BarrelEvent,
  DistilleryControlTowerSummary,
  DistillingInventoryRecord,
  InventoryLot,
  InventoryMovement,
  SafeUser,
} from "@shared/schema";
import {
  MIN_RECORD_RETENTION_YEARS,
  addYearsIso,
  defaultDueDateForCadence,
  deriveCadenceFromPeriod,
  deriveComplianceAreaFromType,
  isRetentionLocked,
  ttbFilingCadences,
} from "./compliance-policy";
import {
  buildDistilleryReadinessMetrics,
  prepareBarrelEventForBarrel,
  prepareInventoryMovementForLot,
} from "./distillery-ops";

declare module "express-session" {
  interface SessionData {
    user: SafeUser;
    csrfToken?: string;
  }
}

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(["admin", "distiller", "cellar"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

const calculatorComputeSchema = z.object({
  calculationType: calculationTypeSchema,
  inputs: z.record(z.number()),
});

const weekPeriodKeyPattern = /^(\d{4})-W(\d{1,2})$/i;

function normalizeDistillingPeriodKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const match = weekPeriodKeyPattern.exec(trimmed);
  if (!match) return undefined;
  const week = Number(match[2]);
  if (!Number.isInteger(week) || week < 1 || week > 53) return undefined;
  return `${match[1]}-W${String(week).padStart(2, "0")}`;
}

function normalizeDistillingInventoryPayload(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const payload = { ...(value as Record<string, unknown>) };
  const legacyMonthlyKeys = [
    "reportMonth",
    "beginningOfMonthCases",
    "currentMonthInventory",
    "endingMonthInventory",
  ];
  const hasLegacyMonthlyKeys = legacyMonthlyKeys.some((key) => key in payload);

  if (hasLegacyMonthlyKeys) {
    throw new Error(
      "Weekly fields are required: use reportWeek, beginningOfWeekCases, currentWeekInventory, endingWeekInventory",
    );
  }

  if (payload.reportWeek != null) {
    payload.reportMonth = payload.reportWeek;
  }
  if (payload.beginningOfWeekCases != null) {
    payload.beginningOfMonthCases = payload.beginningOfWeekCases;
  }
  if (payload.currentWeekInventory != null) {
    payload.currentMonthInventory = payload.currentWeekInventory;
  }
  if (payload.endingWeekInventory != null) {
    payload.endingMonthInventory = payload.endingWeekInventory;
  }

  return payload;
}

function withWeeklyInventoryAliases(record: DistillingInventoryRecord) {
  const {
    reportMonth: reportWeek,
    beginningOfMonthCases: beginningOfWeekCases,
    currentMonthInventory: currentWeekInventory,
    endingMonthInventory: endingWeekInventory,
    ...rest
  } = record;

  return {
    ...rest,
    reportWeek,
    beginningOfWeekCases,
    currentWeekInventory,
    endingWeekInventory,
  };
}

function withWeeklyControlTowerAliases(summary: DistilleryControlTowerSummary) {
  const {
    reportMonth: reportWeek,
    inventory: {
      beginningOfMonthCases: beginningOfWeekCases,
      currentMonthInventory: currentWeekInventory,
      endingMonthInventory: endingWeekInventory,
      ...inventoryRest
    },
    ...rest
  } = summary;

  return {
    ...rest,
    reportWeek,
    inventory: {
      ...inventoryRest,
      beginningOfWeekCases,
      currentWeekInventory,
      endingWeekInventory,
    },
  };
}

const loginRateLimiter = new LoginRateLimiter();

const createTtbReportRequestSchema = z
  .object({
    reportPeriodStart: z.string().trim().min(1),
    reportPeriodEnd: z.string().trim().min(1),
    filingType: z.enum(ttbReportTypes).optional().nullable(),
    filingCadence: z.enum(ttbFilingCadences).optional().nullable(),
    dueDate: z.string().trim().optional().nullable(),
    exciseTaxDue: z.number().finite().optional().nullable(),
    retentionUntil: z.string().trim().optional().nullable(),
  })
  .strict();

const updateTtbReportRequestSchema = z
  .object({
    filingType: z.enum(ttbReportTypes).optional().nullable(),
    filingCadence: z.enum(ttbFilingCadences).optional().nullable(),
    dueDate: z.string().trim().optional().nullable(),
    exciseTaxDue: z.number().finite().optional().nullable(),
    retentionUntil: z.string().trim().optional().nullable(),
  })
  .strict();

function runCalculator(
  calculationType: z.infer<typeof calculationTypeSchema>,
  inputs: Record<string, number>,
): { result: number; unit: string; details: string } {
  if (calculationType === "proof_gallons") {
    const volumeGallons = inputs.volumeGallons ?? 0;
    const abvPercent = inputs.abvPercent ?? 0;
    return {
      result: (volumeGallons * abvPercent) / 100,
      unit: "proof_gallons",
      details: "Proof gallons = volume (gallons) * ABV / 100",
    };
  }

  if (calculationType === "abv_to_proof") {
    const abvPercent = inputs.abvPercent ?? 0;
    return {
      result: abvPercent * 2,
      unit: "proof",
      details: "Proof = ABV * 2",
    };
  }

  if (calculationType === "proof_to_abv") {
    const proof = inputs.proof ?? 0;
    return {
      result: proof / 2,
      unit: "abv_percent",
      details: "ABV = Proof / 2",
    };
  }

  const currentVolumeGallons = inputs.currentVolumeGallons ?? 0;
  const currentAbvPercent = inputs.currentAbvPercent ?? 0;
  const targetAbvPercent = inputs.targetAbvPercent ?? 0;
  if (targetAbvPercent <= 0) {
    throw new Error("Target ABV percent must be greater than zero");
  }

  const dilutedVolume = (currentVolumeGallons * currentAbvPercent) / targetAbvPercent;
  return {
    result: Math.max(0, dilutedVolume - currentVolumeGallons),
    unit: "water_gallons",
    details: "Water to add = ((current volume * current ABV) / target ABV) - current volume",
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function requirePolicy(resource: PolicyResource, action: PolicyAction) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!isRoleAuthorized(user.role, resource, action)) {
      return res.status(403).json({ error: "Insufficient permissions for this action" });
    }
    next();
  };
}

function ensureSessionCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = createCsrfToken();
  }
  return req.session.csrfToken;
}

async function regenerateSession(req: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function writeAuditLog(
  req: Request,
  entityType: string,
  entityId: string,
  action: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const actor = req.session?.user;
  try {
    await storage.createAuditLog({
      entityType,
      entityId,
      action,
      actorName: actor?.name || null,
      actorRole: actor?.role || null,
      details,
    });
  } catch {
    // Audit logging must not break primary operations.
  }
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toCsv(payload: Record<string, unknown>): string {
  const round = (value: number) => Number(value.toFixed(2));
  const safeNum = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const safeText = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

  const forms = Array.isArray(payload.standardForms) ? (payload.standardForms as Array<Record<string, unknown>>) : null;
  if (!forms) {
    // Fallback: emit the raw payload as a key/value CSV.
    const rows: Array<[string, string]> = Object.entries(payload).map(([k, v]) => [k, JSON.stringify(v)]);
    const header = "field,value";
    const body = rows.map(([k, v]) => `${k},${v.replace(/,/g, "\\,")}`).join("\n");
    return `${header}\n${body}\n`;
  }

  const header = [
    "form_number",
    "form_title",
    "metric",
    "name",
    "operation_count",
    "gallons",
    "estimated_proof_gallons",
    "amount_usd",
  ].join(",");
  const rows: string[] = [header];

  for (const form of forms) {
    const formNumber = safeText(form.formNumber);
    const title = safeText(form.title);
    const opsIncluded = safeNum(form.operationsIncluded);
    const totalGallons = safeNum(form.totalGallons);
    const totalProof = safeNum(form.totalEstimatedProofGallons);
    const amountUsd =
      typeof form.estimatedExciseTaxDueUsd === "number" && Number.isFinite(form.estimatedExciseTaxDueUsd)
        ? form.estimatedExciseTaxDueUsd
        : "";

    rows.push(
      [
        formNumber,
        title,
        "TOTAL",
        "",
        String(opsIncluded),
        String(round(totalGallons)),
        String(round(totalProof)),
        amountUsd === "" ? "" : String(round(Number(amountUsd))),
      ].join(","),
    );

    const stageSummary = Array.isArray(form.productionStageSummary) ? (form.productionStageSummary as Array<Record<string, unknown>>) : [];
    for (const entry of stageSummary) {
      rows.push(
        [
          formNumber,
          title,
          "STAGE",
          safeText(entry.name),
          String(safeNum(entry.operationCount)),
          String(round(safeNum(entry.quantityGallons))),
          String(round(safeNum(entry.estimatedProofGallons))),
          "",
        ].join(","),
      );
    }

    const taxSummary = Array.isArray(form.taxClassificationSummary) ? (form.taxClassificationSummary as Array<Record<string, unknown>>) : [];
    for (const entry of taxSummary) {
      rows.push(
        [
          formNumber,
          title,
          "TAX_CLASS",
          safeText(entry.name),
          String(safeNum(entry.operationCount)),
          String(round(safeNum(entry.quantityGallons))),
          String(round(safeNum(entry.estimatedProofGallons))),
          "",
        ].join(","),
      );
    }
  }

  return `${rows.join("\n")}\n`;
}

function toSimplePdf(text: string): Buffer {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const contentStream = `BT /F1 12 Tf 40 760 Td (${escaped}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${contentStream.length} >>
stream
${contentStream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000243 00000 n 
0000000313 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
${313 + contentStream.length}
%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function sanitizePdfText(value: string): string {
  // Keep it ASCII-safe so we can treat string-length offsets as byte offsets.
  // Replace non-ASCII characters and newlines with safe placeholders.
  const normalized = value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\r?\n/g, " ")
    .trimEnd();

  const maxLen = 100;
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 3)}...`;
}

function toTextPdf(lines: string[]): Buffer {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 40;
  const marginTop = 40;
  const fontSize = 10;
  const leading = 12;
  const maxLinesPerPage = Math.floor((pageHeight - marginTop * 2) / leading);

  const sanitizedLines = lines.map((line) => sanitizePdfText(line));
  const pages: string[][] = [];
  for (let i = 0; i < sanitizedLines.length; i += maxLinesPerPage) {
    pages.push(sanitizedLines.slice(i, i + maxLinesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  const objectCount = 3 + pages.length * 2;
  const objects: string[] = new Array(objectCount + 1).fill("");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = pages
    .map((_page, idx) => {
      const pageObjId = 4 + idx * 2;
      return `${pageObjId} 0 R`;
    })
    .join(" ");
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  for (let idx = 0; idx < pages.length; idx += 1) {
    const pageObjId = 4 + idx * 2;
    const contentObjId = 5 + idx * 2;
    const pageLines = pages[idx];
    const x = marginLeft;
    const y = pageHeight - marginTop - fontSize;

    const contentParts: string[] = [];
    contentParts.push("BT");
    contentParts.push(`/F1 ${fontSize} Tf`);
    contentParts.push(`${x} ${y} Td`);
    for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex += 1) {
      const escaped = pageLines[lineIndex]
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
      contentParts.push(`(${escaped}) Tj`);
      if (lineIndex < pageLines.length - 1) {
        contentParts.push(`0 -${leading} Td`);
      }
    }
    contentParts.push("ET");
    const contentStream = contentParts.join("\n");

    objects[pageObjId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjId} 0 R >>`;
    objects[contentObjId] = `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = new Array(objectCount + 1).fill(0);
  for (let i = 1; i <= objectCount; i += 1) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objectCount; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Root 1 0 R /Size ${objectCount + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

type TtbOperationCategory = "Storage" | "Processing";

type NormalizedTtbOperation = {
  source: "inventory_movement" | "barrel_event";
  sourceId: string;
  occurredAt: string;
  operationCategory: TtbOperationCategory;
  operationType: string;
  productionStage: string;
  taxClassification: string;
  quantityGallons: number;
  estimatedProofGallons: number;
  signedQuantityGallons: number;
  signedEstimatedProofGallons: number;
  notes: string | null;
  hasExplicitOperationCategory: boolean;
  hasExplicitProductionStage: boolean;
  hasExplicitTaxClassification: boolean;
};

function roundNumber(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function getPeriodBounds(periodStart: string, periodEnd: string): { start: Date; end: Date } {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Report period start and end must be valid dates");
  }
  if (start.getTime() > end.getTime()) {
    throw new Error("Report period start must be on or before report period end");
  }
  return { start, end };
}

function isWithinPeriod(value: string | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime();
}

function normalizeOperationCategory(value: unknown): TtbOperationCategory | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "storage") return "Storage";
  if (normalized === "processing") return "Processing";
  return null;
}

function deriveMovementOperationCategory(movementType: string): TtbOperationCategory {
  if (["Receive", "Transfer", "Adjust"].includes(movementType)) return "Storage";
  return "Processing";
}

function deriveMovementProductionStage(movementType: string): string {
  const defaults: Record<string, string> = {
    Receive: "Receipt",
    Transfer: "Transfer",
    Adjust: "Storage",
    Consume: "Processing",
    Bottle: "Bottling",
    Dispose: "Removal",
  };
  return defaults[movementType] || "Processing";
}

function deriveMovementTaxClassification(movementType: string): string {
  const defaults: Record<string, string> = {
    Receive: "In Bond",
    Transfer: "In Bond",
    Adjust: "In Bond",
    Consume: "Industrial",
    Bottle: "Tax Paid",
    Dispose: "Destruction",
  };
  return defaults[movementType] || "In Bond";
}

function deriveBarrelOperationCategory(eventType: string): TtbOperationCategory {
  if (["Fill", "Transfer"].includes(eventType)) return "Storage";
  return "Processing";
}

function deriveBarrelProductionStage(eventType: string): string {
  const defaults: Record<string, string> = {
    Fill: "Maturation",
    Transfer: "Transfer",
    Sample: "Processing",
    TopOff: "Processing",
    Dump: "Processing",
    Empty: "Removal",
    Retire: "Removal",
  };
  return defaults[eventType] || "Processing";
}

function deriveBarrelTaxClassification(eventType: string): string {
  const defaults: Record<string, string> = {
    Fill: "In Bond",
    Transfer: "In Bond",
    Sample: "Research/Development",
    TopOff: "In Bond",
    Dump: "Tax Paid",
    Empty: "Tax Paid",
    Retire: "Destruction",
  };
  return defaults[eventType] || "In Bond";
}

function summarizeByField(operations: NormalizedTtbOperation[], selector: (op: NormalizedTtbOperation) => string) {
  const totals = new Map<string, { operationCount: number; quantityGallons: number; estimatedProofGallons: number }>();
  for (const operation of operations) {
    const key = selector(operation) || "Unspecified";
    const current = totals.get(key) || { operationCount: 0, quantityGallons: 0, estimatedProofGallons: 0 };
    current.operationCount += 1;
    current.quantityGallons += operation.quantityGallons;
    current.estimatedProofGallons += operation.estimatedProofGallons;
    totals.set(key, current);
  }

  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, values]) => ({
      name,
      operationCount: values.operationCount,
      quantityGallons: roundNumber(values.quantityGallons),
      estimatedProofGallons: roundNumber(values.estimatedProofGallons),
    }));
}

function toOperationLine(operation: NormalizedTtbOperation) {
  return {
    occurredAt: operation.occurredAt,
    source: operation.source,
    operationId: operation.sourceId,
    operationType: operation.operationType,
    productionStage: operation.productionStage,
    taxClassification: operation.taxClassification,
    quantityGallons: roundNumber(operation.quantityGallons),
    estimatedProofGallons: roundNumber(operation.estimatedProofGallons),
    signedQuantityGallons: roundNumber(operation.signedQuantityGallons),
    signedEstimatedProofGallons: roundNumber(operation.signedEstimatedProofGallons),
    notes: operation.notes,
  };
}

function safeParseTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  const ms = parsed.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function computeLotQuantityAtMs(lot: InventoryLot, movements: InventoryMovement[], atMs: number): number {
  let quantity = Number.isFinite(lot.quantity) ? lot.quantity : 0;
  for (const movement of movements) {
    const movementMs = safeParseTimestampMs(movement.performedAt);
    if (movementMs === null) continue;
    if (movementMs <= atMs) continue;

    const magnitude = Math.abs(movement.quantity || 0);
    if (movement.movementType === "Receive") quantity -= magnitude;
    else if (movement.movementType === "Adjust") quantity -= movement.quantity || 0;
    else if (movement.movementType === "Transfer") quantity -= 0;
    else quantity += magnitude;
  }
  return roundNumber(Math.max(0, quantity));
}

function computeLotEstimatedProofGallons(quantityGallons: number, lot: InventoryLot): number {
  if (lot.abv !== null && lot.abv !== undefined) {
    return roundNumber((quantityGallons * lot.abv) / 100);
  }

  // Fall back to the current lot proof ratio when ABV is missing.
  if (lot.quantity > 0 && lot.proofGallons !== null && lot.proofGallons !== undefined) {
    return roundNumber(quantityGallons * (lot.proofGallons / lot.quantity));
  }

  return 0;
}

function computeBarrelVolumeAtMs(barrel: Barrel, events: BarrelEvent[], atMs: number): number {
  let volume = Number.isFinite(barrel.currentVolume ?? 0) ? (barrel.currentVolume ?? 0) : 0;
  for (const event of events) {
    const eventMs = safeParseTimestampMs(event.eventAt);
    if (eventMs === null) continue;
    if (eventMs <= atMs) continue;

    const magnitude = Math.abs(event.volumeChange ?? 0);
    if (event.eventType === "Transfer") {
      continue;
    }
    if (event.eventType === "Fill" || event.eventType === "TopOff") {
      volume -= magnitude;
    } else {
      volume += magnitude;
    }
  }
  return roundNumber(Math.max(0, volume));
}

function computeBarrelEstimatedProofGallons(volumeGallons: number, barrel: Barrel): number {
  const proof = barrel.fillProof ?? 0;
  return roundNumber(volumeGallons * (proof / 100));
}

type InventorySnapshot = {
  asOf: string;
  lotGallons: number;
  lotEstimatedProofGallons: number;
  barrelGallons: number;
  barrelEstimatedProofGallons: number;
  totalGallons: number;
  totalEstimatedProofGallons: number;
};

function buildInventorySnapshot(params: {
  lots: InventoryLot[];
  movementsByLotId: Map<string, InventoryMovement[]>;
  barrels: Barrel[];
  eventsByBarrelId: Map<string, BarrelEvent[]>;
  asOf: Date;
}): InventorySnapshot {
  const atMs = params.asOf.getTime();

  let lotGallons = 0;
  let lotProof = 0;
  for (const lot of params.lots) {
    const movements = params.movementsByLotId.get(lot.id) || [];
    const quantity = computeLotQuantityAtMs(lot, movements, atMs);
    lotGallons += quantity;
    lotProof += computeLotEstimatedProofGallons(quantity, lot);
  }

  let barrelGallons = 0;
  let barrelProof = 0;
  for (const barrel of params.barrels) {
    const events = params.eventsByBarrelId.get(barrel.id) || [];
    const volume = computeBarrelVolumeAtMs(barrel, events, atMs);
    barrelGallons += volume;
    barrelProof += computeBarrelEstimatedProofGallons(volume, barrel);
  }

  return {
    asOf: params.asOf.toISOString(),
    lotGallons: roundNumber(lotGallons),
    lotEstimatedProofGallons: roundNumber(lotProof),
    barrelGallons: roundNumber(barrelGallons),
    barrelEstimatedProofGallons: roundNumber(barrelProof),
    totalGallons: roundNumber(lotGallons + barrelGallons),
    totalEstimatedProofGallons: roundNumber(lotProof + barrelProof),
  };
}

async function buildTtbMonthlyPayload(
  reportPeriodStart: string,
  reportPeriodEnd: string,
  options?: { filingType?: string | null; exciseTaxDue?: number | null },
): Promise<Record<string, unknown>> {
  const { start, end } = getPeriodBounds(reportPeriodStart, reportPeriodEnd);
  const [platformConfig, lots, movements, barrels] = await Promise.all([
    storage.getPlatformConfig(),
    storage.getInventoryLots(),
    storage.getInventoryMovements(),
    storage.getBarrels(),
  ]);
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const barrelById = new Map(barrels.map((barrel) => [barrel.id, barrel]));
  const barrelEventGroups = await Promise.all(barrels.map((barrel) => storage.getBarrelEvents(barrel.id)));
  const barrelEvents = barrelEventGroups.flat();
  const exciseTaxRate = Number.parseFloat(process.env.EXCISE_TAX_RATE_USD_PER_PROOF_GALLON || "");
  const effectiveExciseTaxRate = Number.isFinite(exciseTaxRate) && exciseTaxRate > 0 ? exciseTaxRate : null;

  const operations: NormalizedTtbOperation[] = [];

  for (const movement of movements) {
    if (!isWithinPeriod(movement.performedAt, start, end)) continue;
    const lot = lotById.get(movement.lotId);
    const magnitudeGallons = Math.abs(movement.quantity || 0);
    const signedQuantityGallons =
      movement.movementType === "Receive"
        ? magnitudeGallons
        : movement.movementType === "Adjust"
          ? movement.quantity || 0
          : movement.movementType === "Transfer"
            ? 0
            : -magnitudeGallons;
    const proofRatio =
      lot && lot.quantity > 0 && lot.proofGallons !== null && lot.proofGallons !== undefined
        ? lot.proofGallons / lot.quantity
        : lot?.abv !== null && lot?.abv !== undefined
          ? lot.abv / 100
          : 0;

    const explicitCategory = normalizeOperationCategory(movement.ttbOperationCategory);
    const explicitStage = movement.productionStage?.trim() || null;
    const explicitTax = movement.taxClassification?.trim() || null;

    operations.push({
      source: "inventory_movement",
      sourceId: movement.id,
      occurredAt: movement.performedAt,
      operationCategory: explicitCategory || deriveMovementOperationCategory(movement.movementType),
      operationType: movement.movementType,
      productionStage: explicitStage || deriveMovementProductionStage(movement.movementType),
      taxClassification: explicitTax || deriveMovementTaxClassification(movement.movementType),
      quantityGallons: magnitudeGallons,
      estimatedProofGallons: magnitudeGallons * proofRatio,
      signedQuantityGallons,
      signedEstimatedProofGallons: signedQuantityGallons * proofRatio,
      notes: movement.reason || null,
      hasExplicitOperationCategory: Boolean(explicitCategory),
      hasExplicitProductionStage: Boolean(explicitStage),
      hasExplicitTaxClassification: Boolean(explicitTax),
    });
  }

  for (const event of barrelEvents) {
    if (!isWithinPeriod(event.eventAt, start, end)) continue;
    const barrel = barrelById.get(event.barrelId);
    const magnitudeGallons = Math.abs(event.volumeChange ?? 0);
    const signedQuantityGallons =
      event.eventType === "Transfer"
        ? 0
        : event.eventType === "Fill" || event.eventType === "TopOff"
          ? magnitudeGallons
          : -magnitudeGallons;
    const proof = event.proofAtEvent ?? barrel?.fillProof ?? 0;

    const explicitCategory = normalizeOperationCategory(event.ttbOperationCategory);
    const explicitStage = event.productionStage?.trim() || null;
    const explicitTax = event.taxClassification?.trim() || null;

    operations.push({
      source: "barrel_event",
      sourceId: event.id,
      occurredAt: event.eventAt,
      operationCategory: explicitCategory || deriveBarrelOperationCategory(event.eventType),
      operationType: event.eventType,
      productionStage: explicitStage || deriveBarrelProductionStage(event.eventType),
      taxClassification: explicitTax || deriveBarrelTaxClassification(event.eventType),
      quantityGallons: magnitudeGallons,
      estimatedProofGallons: magnitudeGallons * (proof / 100),
      signedQuantityGallons,
      signedEstimatedProofGallons: signedQuantityGallons * (proof / 100),
      notes: event.notes || null,
      hasExplicitOperationCategory: Boolean(explicitCategory),
      hasExplicitProductionStage: Boolean(explicitStage),
      hasExplicitTaxClassification: Boolean(explicitTax),
    });
  }

  const orderedOperations = operations.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const storageOperations = orderedOperations.filter((operation) => operation.operationCategory === "Storage");
  const processingOperations = orderedOperations.filter((operation) => operation.operationCategory === "Processing");
  const fullyTaggedCount = orderedOperations.filter(
    (operation) =>
      operation.hasExplicitOperationCategory &&
      operation.hasExplicitProductionStage &&
      operation.hasExplicitTaxClassification,
  ).length;
  const totalQuantityGallons = orderedOperations.reduce((sum, operation) => sum + operation.quantityGallons, 0);
  const totalEstimatedProofGallons = orderedOperations.reduce(
    (sum, operation) => sum + operation.estimatedProofGallons,
    0,
  );
  const netSignedQuantityGallons = orderedOperations.reduce((sum, operation) => sum + operation.signedQuantityGallons, 0);
  const netSignedEstimatedProofGallons = orderedOperations.reduce(
    (sum, operation) => sum + operation.signedEstimatedProofGallons,
    0,
  );

  const movementsByLotId = new Map<string, InventoryMovement[]>();
  for (const movement of movements) {
    if (!movementsByLotId.has(movement.lotId)) movementsByLotId.set(movement.lotId, []);
    movementsByLotId.get(movement.lotId)!.push(movement);
  }
  movementsByLotId.forEach((group) => {
    group.sort((left, right) => right.performedAt.localeCompare(left.performedAt));
  });

  const eventsByBarrelId = new Map<string, BarrelEvent[]>();
  for (const event of barrelEvents) {
    if (!eventsByBarrelId.has(event.barrelId)) eventsByBarrelId.set(event.barrelId, []);
    eventsByBarrelId.get(event.barrelId)!.push(event);
  }
  eventsByBarrelId.forEach((group) => {
    group.sort((left, right) => right.eventAt.localeCompare(left.eventAt));
  });

  const beginSnapshot = buildInventorySnapshot({
    lots,
    movementsByLotId,
    barrels,
    eventsByBarrelId,
    asOf: new Date(start.getTime() - 1),
  });
  const endSnapshot = buildInventorySnapshot({
    lots,
    movementsByLotId,
    barrels,
    eventsByBarrelId,
    asOf: end,
  });

  const expectedEndGallons = roundNumber(beginSnapshot.totalGallons + netSignedQuantityGallons);
  const expectedEndProofGallons = roundNumber(beginSnapshot.totalEstimatedProofGallons + netSignedEstimatedProofGallons);
  const inventoryDeltaGallons = roundNumber(endSnapshot.totalGallons - expectedEndGallons);
  const inventoryDeltaProofGallons = roundNumber(endSnapshot.totalEstimatedProofGallons - expectedEndProofGallons);

  function formSummary(formNumber: string, title: string, filtered: NormalizedTtbOperation[]) {
    const totalGallons = filtered.reduce((sum, op) => sum + op.quantityGallons, 0);
    const totalProof = filtered.reduce((sum, op) => sum + op.estimatedProofGallons, 0);
    return {
      formNumber,
      title,
      operationsIncluded: filtered.length,
      totalGallons: roundNumber(totalGallons),
      totalEstimatedProofGallons: roundNumber(totalProof),
      productionStageSummary: summarizeByField(filtered, (op) => op.productionStage),
      taxClassificationSummary: summarizeByField(filtered, (op) => op.taxClassification),
      operationTypeSummary: summarizeByField(filtered, (op) => op.operationType),
    };
  }

  const productionOps = orderedOperations.filter((op) => ["Distillation", "Blending"].includes(op.productionStage));
  const denaturingOps = orderedOperations.filter((op) => op.taxClassification === "Industrial");
  const exciseOps = orderedOperations.filter((op) => {
    if (op.taxClassification !== "Tax Paid") return false;
    if (op.productionStage === "Removal" || op.productionStage === "Bottling") return true;
    return ["Bottle", "Dispose", "Dump", "Empty", "Retire"].includes(op.operationType);
  });
  const taxableRemovalGallons = exciseOps.reduce((sum, op) => (op.signedQuantityGallons < 0 ? sum - op.signedQuantityGallons : sum), 0);
  const taxableRemovalProof = exciseOps.reduce(
    (sum, op) => (op.signedEstimatedProofGallons < 0 ? sum - op.signedEstimatedProofGallons : sum),
    0,
  );
  const estimatedExciseTaxDue =
    effectiveExciseTaxRate !== null ? roundNumber(taxableRemovalProof * effectiveExciseTaxRate) : null;

  const suppliedExciseTaxDue = options?.exciseTaxDue ?? null;
  const exciseVariance =
    suppliedExciseTaxDue !== null && estimatedExciseTaxDue !== null
      ? roundNumber(suppliedExciseTaxDue - estimatedExciseTaxDue)
      : null;

  const inventoryBalanceOk = Math.abs(inventoryDeltaGallons) <= 0.5 && Math.abs(inventoryDeltaProofGallons) <= 0.5;
  const exciseOk =
    suppliedExciseTaxDue === null ||
    estimatedExciseTaxDue === null ||
    suppliedExciseTaxDue + 1 >= estimatedExciseTaxDue;

  const productionSupplyProof = productionOps.reduce(
    (sum, op) => (op.signedEstimatedProofGallons > 0 ? sum + op.signedEstimatedProofGallons : sum),
    0,
  );
  const availableProofForTax = roundNumber(beginSnapshot.totalEstimatedProofGallons + productionSupplyProof);
  const productionVsTaxOk = taxableRemovalProof <= availableProofForTax + 0.5;

  return {
    reportProfile: "ttb-monthly-compliance-packet-v1",
    period: {
      start: reportPeriodStart,
      end: reportPeriodEnd,
    },
    organization: {
      name: platformConfig.organizationName,
      address: platformConfig.primaryAddress,
      timeZone: platformConfig.timeZone,
    },
    filingContext: {
      filingType: options?.filingType || null,
      exciseTaxRateUsdPerProofGallon: effectiveExciseTaxRate,
      exciseTaxDueProvided: suppliedExciseTaxDue,
    },
    generatedAt: new Date().toISOString(),
    summary: {
      totalOperations: orderedOperations.length,
      storageOperationCount: storageOperations.length,
      processingOperationCount: processingOperations.length,
      totalQuantityGallons: roundNumber(totalQuantityGallons),
      totalEstimatedProofGallons: roundNumber(totalEstimatedProofGallons),
      netSignedQuantityGallons: roundNumber(netSignedQuantityGallons),
      netSignedEstimatedProofGallons: roundNumber(netSignedEstimatedProofGallons),
      taggedOperationCoveragePercent:
        orderedOperations.length === 0
          ? 100
          : roundNumber((fullyTaggedCount / orderedOperations.length) * 100),
      untaggedOperationCount: Math.max(0, orderedOperations.length - fullyTaggedCount),
    },
    snapshots: {
      begin: beginSnapshot,
      expectedEnd: {
        totalGallons: expectedEndGallons,
        totalEstimatedProofGallons: expectedEndProofGallons,
      },
      end: endSnapshot,
      delta: {
        gallons: inventoryDeltaGallons,
        estimatedProofGallons: inventoryDeltaProofGallons,
      },
    },
    standardForms: [
      formSummary("TTB F 5110.40", "Monthly Report of Production Operations", productionOps),
      formSummary("TTB F 5110.11", "Monthly Report of Storage Operations", storageOperations),
      formSummary("TTB F 5110.28", "Monthly Report of Processing Operations", processingOperations),
      formSummary("TTB F 5110.43", "Monthly Report of Processing (Denaturing) Operations", denaturingOps),
      {
        ...formSummary("TTB F 5000.24", "Excise Tax Return (Estimate)", exciseOps),
        taxableRemovalGallons: roundNumber(taxableRemovalGallons),
        taxableRemovalEstimatedProofGallons: roundNumber(taxableRemovalProof),
        exciseTaxRateUsdPerProofGallon: effectiveExciseTaxRate,
        estimatedExciseTaxDueUsd: estimatedExciseTaxDue,
        exciseTaxDueProvidedUsd: suppliedExciseTaxDue,
        exciseTaxVarianceUsd: exciseVariance,
      },
    ],
    validations: {
      physicalInventoryMatchesReportedInventory: {
        status: inventoryBalanceOk ? "pass" : "warn",
        deltaGallons: inventoryDeltaGallons,
        deltaEstimatedProofGallons: inventoryDeltaProofGallons,
        note:
          "This check reconciles beginning inventory + net ledger deltas against the computed ending inventory snapshot. Large deltas indicate missing transfers or mis-recorded operations.",
      },
      reportedProductionMatchesTaxFilings: {
        status: productionVsTaxOk ? "pass" : "warn",
        producedEstimatedProofGallons: roundNumber(productionSupplyProof),
        taxableRemovalEstimatedProofGallons: roundNumber(taxableRemovalProof),
        availableEstimatedProofGallons: availableProofForTax,
        note:
          "This check ensures taxable removals do not exceed available proof gallons (beginning + produced). It is conservative and depends on accurate tagging.",
      },
      notUnderReportingExciseTaxes: {
        status:
          effectiveExciseTaxRate === null
            ? "needs_config"
            : suppliedExciseTaxDue === null
              ? "needs_input"
              : exciseOk
                ? "pass"
                : "warn",
        exciseTaxRateUsdPerProofGallon: effectiveExciseTaxRate,
        estimatedExciseTaxDueUsd: estimatedExciseTaxDue,
        exciseTaxDueProvidedUsd: suppliedExciseTaxDue,
        varianceUsd: exciseVariance,
        note:
          "Set EXCISE_TAX_RATE_USD_PER_PROOF_GALLON to compute an estimate. Provide Excise Tax Due to compare against the estimate.",
      },
    },
    productionStageSummary: summarizeByField(orderedOperations, (operation) => operation.productionStage),
    taxClassificationSummary: summarizeByField(orderedOperations, (operation) => operation.taxClassification),
    storageOperations: storageOperations.map(toOperationLine),
    processingOperations: processingOperations.map(toOperationLine),
  };
}

function padRight(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  return value + " ".repeat(width - value.length);
}

function padLeft(value: string, width: number): string {
  if (value.length >= width) return value.slice(-width);
  return " ".repeat(width - value.length) + value;
}

function buildTtbPacketPdfLines(report: {
  id: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  filingType?: string | null;
  filingCadence?: string | null;
  dueDate?: string | null;
  exciseTaxDue?: number | null;
  status: string;
}, payload: Record<string, unknown>): string[] {
  const lines: string[] = [];

  const org = (payload.organization || {}) as Record<string, unknown>;
  const orgName = typeof org.name === "string" ? org.name : "OakCellar";
  const orgAddress = typeof org.address === "string" ? org.address : "";

  lines.push(`${orgName} | TTB Compliance Packet`);
  if (orgAddress) lines.push(orgAddress);
  lines.push("");
  lines.push(`Report ID: ${report.id}`);
  lines.push(`Period: ${report.reportPeriodStart} to ${report.reportPeriodEnd}`);
  lines.push(`Filing Type: ${report.filingType || "Monthly Compliance Packet"}`);
  lines.push(`Cadence: ${report.filingCadence || "Monthly"}`);
  lines.push(`Due Date: ${report.dueDate || "Not set"}`);
  lines.push(`Status: ${report.status}`);
  if (typeof report.exciseTaxDue === "number" && Number.isFinite(report.exciseTaxDue)) {
    lines.push(`Excise Tax Due (Provided): $${report.exciseTaxDue.toFixed(2)}`);
  }
  lines.push("");
  lines.push("NOTE: This packet is generated from internal ledger operations. It is not an official TTB form.");
  lines.push("      Use it for reconciliation and as a data-entry aid for official filings.");
  lines.push("");

  const summary = (payload.summary || {}) as Record<string, unknown>;
  const totalOps = typeof summary.totalOperations === "number" ? summary.totalOperations : 0;
  const storageOps = typeof summary.storageOperationCount === "number" ? summary.storageOperationCount : 0;
  const processingOps = typeof summary.processingOperationCount === "number" ? summary.processingOperationCount : 0;
  const coverage = typeof summary.taggedOperationCoveragePercent === "number" ? summary.taggedOperationCoveragePercent : 0;
  const totalProof = typeof summary.totalEstimatedProofGallons === "number" ? summary.totalEstimatedProofGallons : 0;

  lines.push("High-Level Summary");
  lines.push("------------------");
  lines.push(`Total Operations: ${totalOps}`);
  lines.push(`Storage Ops: ${storageOps} | Processing Ops: ${processingOps}`);
  lines.push(`Tagged Coverage: ${coverage.toFixed(0)}%`);
  lines.push(`Estimated Proof Gallons (Activity): ${totalProof.toFixed(2)}`);
  lines.push("");

  const snapshots = (payload.snapshots || {}) as Record<string, unknown>;
  const begin = (snapshots.begin || {}) as Record<string, unknown>;
  const end = (snapshots.end || {}) as Record<string, unknown>;
  const delta = (snapshots.delta || {}) as Record<string, unknown>;
  if (Object.keys(begin).length || Object.keys(end).length) {
    const beginGallons = typeof begin.totalGallons === "number" ? begin.totalGallons : 0;
    const beginProof = typeof begin.totalEstimatedProofGallons === "number" ? begin.totalEstimatedProofGallons : 0;
    const endGallons = typeof end.totalGallons === "number" ? end.totalGallons : 0;
    const endProof = typeof end.totalEstimatedProofGallons === "number" ? end.totalEstimatedProofGallons : 0;
    const deltaGallons = typeof delta.gallons === "number" ? delta.gallons : 0;
    const deltaProof = typeof delta.estimatedProofGallons === "number" ? delta.estimatedProofGallons : 0;

    lines.push("Inventory Reconciliation (Ledger Snapshot)");
    lines.push("-----------------------------------------");
    lines.push(`Beginning Inventory: ${beginGallons.toFixed(2)} gal | ${beginProof.toFixed(2)} proof gal`);
    lines.push(`Ending Inventory:    ${endGallons.toFixed(2)} gal | ${endProof.toFixed(2)} proof gal`);
    lines.push(`Balance Delta:       ${deltaGallons.toFixed(2)} gal | ${deltaProof.toFixed(2)} proof gal`);
    lines.push("");
  }

  lines.push("Standard Forms (Computed Rollups)");
  lines.push("---------------------------------");

  const forms = Array.isArray(payload.standardForms) ? (payload.standardForms as Array<Record<string, unknown>>) : [];
  for (const form of forms) {
    const formNumber = typeof form.formNumber === "string" ? form.formNumber : "TTB Form";
    const title = typeof form.title === "string" ? form.title : "";
    const operationsIncluded = typeof form.operationsIncluded === "number" ? form.operationsIncluded : 0;
    const totalGallons = typeof form.totalGallons === "number" ? form.totalGallons : 0;
    const totalFormProof = typeof form.totalEstimatedProofGallons === "number" ? form.totalEstimatedProofGallons : 0;

    lines.push(`${formNumber} | ${title}`);
    lines.push(`  Ops Included: ${operationsIncluded} | Gallons: ${totalGallons.toFixed(2)} | Proof Gal: ${totalFormProof.toFixed(2)}`);

    if (typeof form.estimatedExciseTaxDueUsd === "number" && Number.isFinite(form.estimatedExciseTaxDueUsd)) {
      lines.push(`  Estimated Excise Tax Due: $${form.estimatedExciseTaxDueUsd.toFixed(2)}`);
    }

    const stageSummary = Array.isArray(form.productionStageSummary) ? (form.productionStageSummary as Array<Record<string, unknown>>) : [];
    if (stageSummary.length) {
      lines.push("  Stage Breakdown");
      lines.push(`  ${padRight("Stage", 18)} ${padLeft("Ops", 5)} ${padLeft("Gal", 12)} ${padLeft("Proof", 12)}`);
      for (const entry of stageSummary.slice(0, 8)) {
        const name = typeof entry.name === "string" ? entry.name : "Unspecified";
        const ops = typeof entry.operationCount === "number" ? entry.operationCount : 0;
        const gallons = typeof entry.quantityGallons === "number" ? entry.quantityGallons : 0;
        const proof = typeof entry.estimatedProofGallons === "number" ? entry.estimatedProofGallons : 0;
        lines.push(`  ${padRight(name, 18)} ${padLeft(String(ops), 5)} ${padLeft(gallons.toFixed(2), 12)} ${padLeft(proof.toFixed(2), 12)}`);
      }
    }

    lines.push("");
  }

  const validations = (payload.validations || {}) as Record<string, unknown>;
  if (Object.keys(validations).length) {
    lines.push("Validation Checks");
    lines.push("-----------------");

    for (const [key, raw] of Object.entries(validations)) {
      const record = (raw || {}) as Record<string, unknown>;
      const status = typeof record.status === "string" ? record.status : "unknown";
      lines.push(`${key}: ${status}`);
      if (typeof record.note === "string" && record.note.trim()) {
        lines.push(`  ${record.note.trim()}`);
      }
    }
    lines.push("");
  }

  lines.push("Exports");
  lines.push("-------");
  lines.push("JSON includes full packet payload (forms + operations + validations).");
  lines.push("CSV includes form rollups and breakdowns.");
  lines.push("");

  return lines;
}

function computeComplianceAreaStatus(records: Array<{
  regulatoryArea?: string | null | undefined;
  expires: string | null | undefined;
  status: string;
}>) {
  if (records.length === 0) {
    return {
      status: "missing",
      expiringCount: 0,
      expiredCount: 0,
      totalRecords: 0,
    };
  }

  const now = new Date();
  const warningDate = new Date(now);
  warningDate.setUTCDate(warningDate.getUTCDate() + 30);

  let expiringCount = 0;
  let expiredCount = 0;
  for (const record of records) {
    const status = (record.status || "").toLowerCase();
    if (status.includes("missing") || status.includes("expired")) {
      expiredCount += 1;
      continue;
    }

    if (!record.expires) continue;
    const expires = new Date(record.expires);
    if (Number.isNaN(expires.getTime())) continue;
    if (expires.getTime() < now.getTime()) expiredCount += 1;
    else if (expires.getTime() <= warningDate.getTime()) expiringCount += 1;
  }

  const status = expiredCount > 0 ? "at_risk" : expiringCount > 0 ? "expiring" : "compliant";
  return {
    status,
    expiringCount,
    expiredCount,
    totalRecords: records.length,
  };
}

async function buildComplianceOverview() {
  const [complianceRecords, lots, movements, barrels, reports, auditLogs] = await Promise.all([
    storage.getCompliance(),
    storage.getInventoryLots(),
    storage.getInventoryMovements(),
    storage.getBarrels(),
    storage.getTtbReports(),
    storage.getAuditLogs(1000),
  ]);
  const barrelEventGroups = await Promise.all(barrels.map((barrel) => storage.getBarrelEvents(barrel.id)));
  const barrelEvents = barrelEventGroups.flat();

  const allOperationRecords = [...movements, ...barrelEvents];
  const taggedOperations = allOperationRecords.filter((operation) => {
    const ttbOperationCategory = "ttbOperationCategory" in operation ? operation.ttbOperationCategory : null;
    const productionStage = "productionStage" in operation ? operation.productionStage : null;
    const taxClassification = "taxClassification" in operation ? operation.taxClassification : null;
    return Boolean(ttbOperationCategory && productionStage && taxClassification);
  });
  const taggedCoveragePercent =
    allOperationRecords.length === 0 ? 100 : roundNumber((taggedOperations.length / allOperationRecords.length) * 100, 1);

  const byArea = new Map<string, typeof complianceRecords>();
  for (const record of complianceRecords) {
    const area = record.regulatoryArea || deriveComplianceAreaFromType(record.type);
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area)!.push(record);
  }

  const areas = [
    "TTB Reporting",
    "Excise Tax",
    "Production Records",
    "Storage Records",
    "COLA Labeling",
    "Data Privacy",
    "Payment Security",
    "Safety",
  ];

  const controls = Object.fromEntries(
    areas.map((area) => {
      const records = byArea.get(area) || [];
      return [area, computeComplianceAreaStatus(records)];
    }),
  );

  const now = new Date();
  const in30Days = new Date(now);
  in30Days.setUTCDate(in30Days.getUTCDate() + 30);
  const overdueFilings = reports.filter((report) => {
    if (!report.dueDate) return false;
    const due = new Date(`${report.dueDate}T23:59:59.999Z`);
    if (Number.isNaN(due.getTime())) return false;
    return due.getTime() < now.getTime() && report.status !== "Exported";
  });
  const filingsDueSoon = reports.filter((report) => {
    if (!report.dueDate) return false;
    const due = new Date(`${report.dueDate}T23:59:59.999Z`);
    if (Number.isNaN(due.getTime())) return false;
    return due.getTime() >= now.getTime() && due.getTime() <= in30Days.getTime() && report.status !== "Exported";
  });

  const retentionPool = [...complianceRecords.map((record) => record.retentionUntil), ...reports.map((r) => r.retentionUntil)];
  const protectedRecordCount = retentionPool.filter((retentionUntil) => isRetentionLocked(retentionUntil)).length;
  const nextRetentionReleaseDate = retentionPool
    .filter((retentionUntil): retentionUntil is string => Boolean(retentionUntil))
    .map((retentionUntil) => new Date(retentionUntil))
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() > now.getTime())
    .sort((left, right) => left.getTime() - right.getTime())[0];

  const last30Days = new Date(now);
  last30Days.setUTCDate(last30Days.getUTCDate() - 30);
  const auditEventsLast30Days = auditLogs.filter((entry) => {
    const occurredAt = new Date(entry.occurredAt);
    return !Number.isNaN(occurredAt.getTime()) && occurredAt.getTime() >= last30Days.getTime();
  }).length;
  const distilleryReadiness = buildDistilleryReadinessMetrics({
    lots,
    movements,
    barrels,
    barrelEvents,
    now,
  });

  return {
    baseline: {
      retentionYearsMinimum: MIN_RECORD_RETENTION_YEARS,
      legalRecordPreservation: "enabled",
      operationTagCoveragePercent: taggedCoveragePercent,
      trackedOperationCount: allOperationRecords.length,
    },
    ttbFilings: {
      overdueCount: overdueFilings.length,
      dueInNext30DaysCount: filingsDueSoon.length,
      cadenceBreakdown: reports.reduce<Record<string, number>>((acc, report) => {
        const cadence = report.filingCadence || deriveCadenceFromPeriod(report.reportPeriodStart, report.reportPeriodEnd);
        acc[cadence] = (acc[cadence] || 0) + 1;
        return acc;
      }, {}),
    },
    controls,
    retention: {
      protectedRecordCount,
      nextRetentionReleaseDate: nextRetentionReleaseDate?.toISOString() || null,
    },
    audit: {
      totalEvents: auditLogs.length,
      eventsLast30Days: auditEventsLast30Days,
    },
    distilleryReadiness,
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    if (req.session?.user) {
      const csrfToken = ensureSessionCsrfToken(req);
      res.setHeader("X-CSRF-Token", csrfToken);
    }
    next();
  });

  app.use((req, res, next) => {
    if (!req.session?.user) return next();
    if (!shouldEnforceCsrf(req.method, req.path)) return next();

    const expectedToken = ensureSessionCsrfToken(req);
    const providedToken = req.get(CSRF_HEADER_NAME);
    if (!isCsrfTokenValid(providedToken, expectedToken)) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
    next();
  });

  // Auth
  app.post("/api/auth/login", async (req, res) => {
    const clientKey = getLoginClientKey(req);
    const retryAfterSeconds = loginRateLimiter.getRetryAfterSeconds(clientKey);
    if (retryAfterSeconds > 0) {
      return res
        .status(429)
        .json({ error: "Too many login attempts. Please wait and try again.", retryAfterSeconds });
    }

    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await authStorage.validateCredentials(email, password);
      if (!user) {
        loginRateLimiter.registerFailure(clientKey);
        return res.status(401).json({ error: "Invalid email or password" });
      }
      await regenerateSession(req);
      req.session.user = user;
      req.session.csrfToken = createCsrfToken();
      res.setHeader("X-CSRF-Token", req.session.csrfToken);
      loginRateLimiter.registerSuccess(clientKey);
      res.json({ user, csrfToken: req.session.csrfToken });
    } catch (error: unknown) {
      if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid login data" });
      }
      res.status(500).json({ error: "Failed to establish authenticated session" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Failed to logout" });
      res.clearCookie("connect.sid", { path: "/" });
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const csrfToken = ensureSessionCsrfToken(req);
    res.setHeader("X-CSRF-Token", csrfToken);
    res.json({ user: req.session.user, csrfToken });
  });

  const createUserHandler = async (req: Request, res: Response) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((issue) => {
            const field = issue.path[0];
            if (field === "email") return "Enter a valid email address.";
            if (field === "password") return "Password must be at least 8 characters.";
            if (field === "name") return "Name is required.";
            if (field === "role") return "Select a valid role.";
            if (field === "status") return "Select a valid status.";
            return issue.message;
          })
          .join(" ");
        return res.status(400).json({ error: message || "Invalid user payload." });
      }

      const payload = {
        ...parsed.data,
        name: parsed.data.name.trim(),
        email: parsed.data.email.trim().toLowerCase(),
      };

      const user = await authStorage.createUser(payload);
      res.status(201).json({ user });
    } catch (error: any) {
      const fallbackMessage = "Failed to create user.";
      const message = String(error?.message || fallbackMessage);
      const friendlyMessage =
        message === "The string did not match the expected pattern."
          ? "Unable to create user with the provided format. Confirm email format (name@domain.com) and try again."
          : message;
      res.status(400).json({ error: friendlyMessage || fallbackMessage });
    }
  };

  app.post("/api/users", requireAdmin, createUserHandler);
  app.post("/api/auth/register", requireAdmin, createUserHandler);

  // Users
  app.get("/api/users", requireAdmin, async (_req, res) => {
    try {
      const users = await authStorage.getUsers();
      const safeUsers = users.map(({ passwordHash, ...u }) => u);
      res.json(safeUsers);
    } catch {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const user = await authStorage.getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const payload = updateUserSchema.parse(req.body);
      const updates: { name?: string; email?: string; role?: SafeUser["role"]; status?: SafeUser["status"] } = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.email !== undefined) updates.email = payload.email.toLowerCase().trim();
      if (payload.role !== undefined) updates.role = payload.role;
      if (payload.status !== undefined) updates.status = payload.status;

      const user = await authStorage.updateUser(req.params.id, updates);
      res.json(user);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ error: "Invalid user payload" });
      res.status(400).json({ error: error.message || "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      if (req.session.user?.id === req.params.id) {
        return res.status(400).json({ error: "Cannot delete your own user profile" });
      }
      await authStorage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete user" });
    }
  });

  // Workforce resourcing
  app.get("/api/workers/resourcing", requireAuth, async (_req, res) => {
    try {
      const users = await authStorage.getUsers();
      const operatorUsers = users.filter((u) => u.role === "distiller");
      const jobs = await storage.getJobs();

      const resourcing = operatorUsers.map((user) => {
        const assignedJobs = jobs.filter((job) =>
          job.crew?.some((member) => member.toLowerCase() === user.name.toLowerCase()),
        );

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          role: user.role,
          jobsAssigned: assignedJobs.length,
          jobs: assignedJobs.map((j) => ({ id: j.id, service: j.service, address: j.address, status: j.status })),
        };
      });

      res.json(resourcing);
    } catch {
      res.status(500).json({ error: "Failed to fetch worker resourcing" });
    }
  });

  // Core metrics and settings
  app.get("/api/stats", requireAuth, async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Distilling operations control tower (produced / bottled / sold)
  app.get("/api/distilling/control-tower", requireAuth, async (req, res) => {
    try {
      if (typeof req.query.month === "string") {
        return res.status(400).json({ error: "Use ?week=YYYY-Www (monthly query parameter is no longer supported)" });
      }
      const rawPeriod = typeof req.query.week === "string" ? req.query.week : undefined;
      const period = normalizeDistillingPeriodKey(rawPeriod);
      if (rawPeriod && !period) {
        return res.status(400).json({ error: "Week must be in YYYY-Www format" });
      }
      const summary = await storage.getDistilleryControlTowerSummary(period);
      res.json(withWeeklyControlTowerAliases(summary));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch distilling control tower summary";
      if (error instanceof Error && /Report week must be in YYYY-W\d{2} format|Report week must be in YYYY-Www format/.test(error.message)) {
        return res.status(400).json({ error: "Week must be a valid ISO week in YYYY-Www format" });
      }
      res.status(500).json({ error: message });
    }
  });

  // Distilling batch records
  app.get("/api/distilling/batch-records", requireAuth, async (_req, res) => {
    try {
      const records = await storage.getDistillingBatchRecords();
      res.json(records);
    } catch {
      res.status(500).json({ error: "Failed to fetch distilling batch records" });
    }
  });

  app.get("/api/distilling/batch-records/:id", requireAuth, async (req, res) => {
    try {
      const record = await storage.getDistillingBatchRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Distilling batch record not found" });
      res.json(record);
    } catch {
      res.status(500).json({ error: "Failed to fetch distilling batch record" });
    }
  });

  app.post("/api/distilling/batch-records", requireAuth, async (req, res) => {
    try {
      const payload = insertDistillingBatchRecordSchema.parse(req.body);
      const record = await storage.createDistillingBatchRecord(payload);
      await writeAuditLog(req, "distilling_batch_record", record.id, "create", {
        batchCode: record.batchCode,
        stage: record.stage,
        status: record.status,
      });
      res.status(201).json(record);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid distilling batch record payload";
      res.status(400).json({ error: message });
    }
  });

  app.patch("/api/distilling/batch-records/:id", requireAuth, async (req, res) => {
    try {
      const payload = insertDistillingBatchRecordSchema.partial().parse(req.body);
      const record = await storage.updateDistillingBatchRecord(req.params.id, payload);
      await writeAuditLog(req, "distilling_batch_record", record.id, "update", {
        batchCode: record.batchCode,
        stage: record.stage,
        status: record.status,
      });
      res.json(record);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update distilling batch record";
      res.status(400).json({ error: message });
    }
  });

  app.delete("/api/distilling/batch-records/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteDistillingBatchRecord(req.params.id);
      await writeAuditLog(req, "distilling_batch_record", req.params.id, "delete");
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete distilling batch record";
      res.status(400).json({ error: message });
    }
  });

  // Distilling production records
  app.get("/api/distilling/production-records", requireAuth, async (_req, res) => {
    try {
      const records = await storage.getDistillingProductionRecords();
      res.json(records);
    } catch {
      res.status(500).json({ error: "Failed to fetch distilling production records" });
    }
  });

  app.get("/api/distilling/production-records/:id", requireAuth, async (req, res) => {
    try {
      const record = await storage.getDistillingProductionRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Distilling production record not found" });
      res.json(record);
    } catch {
      res.status(500).json({ error: "Failed to fetch distilling production record" });
    }
  });

  app.post("/api/distilling/production-records", requireAuth, async (req, res) => {
    try {
      const payload = insertDistillingProductionRecordSchema.parse(req.body);
      const record = await storage.createDistillingProductionRecord(payload);
      await writeAuditLog(req, "distilling_production_record", record.id, "create", {
        distillDate: record.distillDate,
        gallonsDistilled: record.gallonsDistilled,
        proofOfGallons: record.proofOfGallons,
      });
      res.status(201).json(record);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid distilling production record payload";
      res.status(400).json({ error: message });
    }
  });

  app.patch("/api/distilling/production-records/:id", requireAuth, async (req, res) => {
    try {
      const payload = insertDistillingProductionRecordSchema.partial().parse(req.body);
      const record = await storage.updateDistillingProductionRecord(req.params.id, payload);
      await writeAuditLog(req, "distilling_production_record", record.id, "update", {
        distillDate: record.distillDate,
        gallonsDistilled: record.gallonsDistilled,
        proofOfGallons: record.proofOfGallons,
      });
      res.json(record);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update distilling production record";
      res.status(400).json({ error: message });
    }
  });

  app.delete("/api/distilling/production-records/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteDistillingProductionRecord(req.params.id);
      await writeAuditLog(req, "distilling_production_record", req.params.id, "delete");
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete distilling production record";
      res.status(400).json({ error: message });
    }
  });

  // Distilling inventory records (weekly cased/bottled/sold rollup)
  app.get("/api/distilling/inventory-records", requireAuth, async (_req, res) => {
    try {
      const records = await storage.getDistillingInventoryRecords();
      res.json(records.map(withWeeklyInventoryAliases));
    } catch {
      res.status(500).json({ error: "Failed to fetch distilling inventory records" });
    }
  });

  app.get("/api/distilling/inventory-records/:id", requireAuth, async (req, res) => {
    try {
      const record = await storage.getDistillingInventoryRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Distilling inventory record not found" });
      res.json(withWeeklyInventoryAliases(record));
    } catch {
      res.status(500).json({ error: "Failed to fetch distilling inventory record" });
    }
  });

  app.post("/api/distilling/inventory-records", requireAuth, async (req, res) => {
    try {
      const payload = insertDistillingInventoryRecordSchema.parse(normalizeDistillingInventoryPayload(req.body));
      const record = await storage.createDistillingInventoryRecord(payload);
      await writeAuditLog(req, "distilling_inventory_record", record.id, "create", {
        title: record.title,
        productName: record.productName,
        linkedBarrelId: record.linkedBarrelId,
        reportWeek: record.reportMonth,
        currentWeekInventory: record.currentMonthInventory,
        endingWeekInventory: record.endingMonthInventory,
        endingProofGallons: record.endingProofGallons,
      });
      res.status(201).json(withWeeklyInventoryAliases(record));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid distilling inventory record payload";
      res.status(400).json({ error: message });
    }
  });

  app.patch("/api/distilling/inventory-records/:id", requireAuth, async (req, res) => {
    try {
      const payload = insertDistillingInventoryRecordSchema.partial().parse(normalizeDistillingInventoryPayload(req.body));
      const record = await storage.updateDistillingInventoryRecord(req.params.id, payload);
      await writeAuditLog(req, "distilling_inventory_record", record.id, "update", {
        title: record.title,
        productName: record.productName,
        linkedBarrelId: record.linkedBarrelId,
        reportWeek: record.reportMonth,
        currentWeekInventory: record.currentMonthInventory,
        endingWeekInventory: record.endingMonthInventory,
        endingProofGallons: record.endingProofGallons,
      });
      res.json(withWeeklyInventoryAliases(record));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update distilling inventory record";
      res.status(400).json({ error: message });
    }
  });

  app.delete("/api/distilling/inventory-records/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteDistillingInventoryRecord(req.params.id);
      await writeAuditLog(req, "distilling_inventory_record", req.params.id, "delete");
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete distilling inventory record";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/platform-config", requireAuth, requirePolicy("platformConfig", "read"), async (_req, res) => {
    try {
      const config = await storage.getPlatformConfig();
      res.json(config);
    } catch {
      res.status(500).json({ error: "Failed to fetch platform configuration" });
    }
  });

  app.patch("/api/platform-config", requireAuth, requirePolicy("platformConfig", "write"), async (req, res) => {
    try {
      const payload = updatePlatformConfigSchema.parse(req.body);
      const config = await storage.updatePlatformConfig(payload);
      res.json(config);
    } catch {
      res.status(400).json({ error: "Failed to update platform configuration" });
    }
  });

  // Production batches (legacy jobs)
  app.get("/api/jobs", requireAuth, async (req, res) => {
    try {
      const { assignedTo } = req.query;
      if (assignedTo && typeof assignedTo === "string") {
        const user = await authStorage.getUserById(assignedTo);
        if (user) {
          const jobs = await storage.getJobsByCrewMemberName(user.name);
          return res.json(jobs);
        }
        return res.json([]);
      }
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch {
      res.status(500).json({ error: "Failed to fetch production batches" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Batch not found" });
      res.json(job);
    } catch {
      res.status(500).json({ error: "Failed to fetch batch" });
    }
  });

  app.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      const payload = insertJobSchema.parse(req.body);
      const job = await storage.createJob(payload);
      res.status(201).json(job);
    } catch {
      res.status(400).json({ error: "Invalid batch payload" });
    }
  });

  app.patch("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id, req.body);
      res.json(job);
    } catch {
      res.status(400).json({ error: "Failed to update batch" });
    }
  });

  app.delete("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteJob(req.params.id);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete batch" });
    }
  });

  // Trading partners (legacy clients)
  app.get("/api/clients", requireAuth, async (_req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch {
      res.status(500).json({ error: "Failed to fetch trading partners" });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) return res.status(404).json({ error: "Trading partner not found" });
      res.json(client);
    } catch {
      res.status(500).json({ error: "Failed to fetch trading partner" });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const payload = insertClientSchema.parse(req.body);
      const client = await storage.createClient(payload);
      res.status(201).json(client);
    } catch {
      res.status(400).json({ error: "Invalid trading partner payload" });
    }
  });

  app.patch("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      res.json(client);
    } catch {
      res.status(400).json({ error: "Failed to update trading partner" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete trading partner" });
    }
  });

  const uploadClientAttachmentSchema = z
    .object({
      originalFilename: z.string().trim().min(1),
      dataUrl: z.string().min(1),
      docType: attachmentDocTypeSchema,
      effectiveOn: z.string().trim().optional().nullable(),
      expiresOn: z.string().trim().optional().nullable(),
      notes: z.string().trim().optional().nullable(),
    })
    .strict();

  app.get("/api/clients/:id/attachments", requireAuth, requirePolicy("clientAttachments", "read"), async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) return res.status(404).json({ error: "Trading partner not found" });
      const attachments = await storage.getAttachmentsForEntity("client", req.params.id);
      res.json(attachments);
    } catch {
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  app.post("/api/clients/:id/attachments", requireAuth, requirePolicy("clientAttachments", "upload"), async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) return res.status(404).json({ error: "Trading partner not found" });

      const payload = uploadClientAttachmentSchema.parse(req.body);

      const uploadsDir = path.join(process.cwd(), "uploads", "attachments", "clients", req.params.id);
      ensureDirectory(uploadsDir);

      const parsedDataUrl = parseBase64DataUrl(payload.dataUrl);
      if (!parsedDataUrl) return res.status(400).json({ error: "Invalid dataUrl format" });
      const { mimeType, buffer: fileBuffer } = parsedDataUrl;

      const uploadValidation = assertAllowedUpload({
        mimeType,
        buffer: fileBuffer,
        maxBytes: MAX_ATTACHMENT_BYTES,
        allowedMimeTypes: ALLOWED_ATTACHMENT_MIME_TYPES,
      });
      if (!uploadValidation.ok) {
        return res.status(400).json({ error: uploadValidation.reason });
      }

      const safeOriginal = sanitizeUploadFilename(payload.originalFilename, "attachment");
      const originalStem = path.parse(safeOriginal).name || "attachment";
      const extension = extensionForMimeType(mimeType) || path.extname(safeOriginal).toLowerCase() || ".bin";
      const safeStoredName = `${originalStem.slice(0, 120)}${extension}`;
      const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
      const uniqueFilename = `${Date.now()}-${sha256.slice(0, 12)}-${safeStoredName}`;
      const absolutePath = path.join(uploadsDir, uniqueFilename);
      fs.writeFileSync(absolutePath, fileBuffer, { flag: "wx" });

      const uploadedBy = req.session.user?.name || req.session.user?.email || "Unknown";

      const attachment = await storage.createAttachment({
        originalFilename: payload.originalFilename,
        filePath: `/uploads/attachments/clients/${req.params.id}/${uniqueFilename}`,
        mimeType,
        byteSize: fileBuffer.byteLength,
        sha256,
        docType: payload.docType,
        effectiveOn: payload.effectiveOn || null,
        expiresOn: payload.expiresOn || null,
        status: "active",
        uploadedBy,
        notes: payload.notes || null,
      });

      await storage.linkAttachment({
        attachmentId: attachment.id,
        entityType: "client",
        entityId: req.params.id,
        relationship: "evidence",
        linkedBy: uploadedBy,
      });

      // Keep only one active attachment per doc type per entity.
      await storage.supersedeActiveAttachmentsForEntityDocType("client", req.params.id, attachment.docType, attachment.id);

      // Denormalized fields used by the compliance dashboard today.
      if (attachment.docType === "COI") {
        await storage.updateClient(req.params.id, { coiExpiresOn: attachment.expiresOn });
      }
      if (attachment.docType === "MASTER_AGREEMENT") {
        await storage.updateClient(req.params.id, { serviceAgreementExpiresOn: attachment.expiresOn });
      }

      await writeAuditLog(req, "attachment", attachment.id, "upload", {
        entityType: "client",
        entityId: req.params.id,
        docType: attachment.docType,
      });

      res.status(201).json(attachment);
    } catch (error: any) {
      const message = error?.name === "ZodError" ? "Invalid attachment payload" : error?.message || "Failed to upload attachment";
      res.status(400).json({ error: message });
    }
  });

  // Facilities (legacy properties)
  app.get("/api/properties", requireAuth, async (_req, res) => {
    try {
      const properties = await storage.getProperties();
      res.json(properties);
    } catch {
      res.status(500).json({ error: "Failed to fetch facilities" });
    }
  });

  app.get("/api/properties/:id", requireAuth, async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) return res.status(404).json({ error: "Facility not found" });
      res.json(property);
    } catch {
      res.status(500).json({ error: "Failed to fetch facility" });
    }
  });

  app.post("/api/properties", requireAuth, async (req, res) => {
    try {
      const payload = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(payload);
      res.status(201).json(property);
    } catch {
      res.status(400).json({ error: "Invalid facility payload" });
    }
  });

  app.patch("/api/properties/:id", requireAuth, async (req, res) => {
    try {
      const property = await storage.updateProperty(req.params.id, req.body);
      res.json(property);
    } catch {
      res.status(400).json({ error: "Failed to update facility" });
    }
  });

  app.delete("/api/properties/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProperty(req.params.id);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete facility" });
    }
  });

  // Team directory
  app.get("/api/staff", requireAuth, async (_req, res) => {
    try {
      const staff = await storage.getStaff();
      res.json(staff);
    } catch {
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  app.get("/api/staff/:id", requireAuth, async (req, res) => {
    try {
      const staff = await storage.getStaffMember(req.params.id);
      if (!staff) return res.status(404).json({ error: "Team member not found" });
      res.json(staff);
    } catch {
      res.status(500).json({ error: "Failed to fetch team member" });
    }
  });

  app.post("/api/staff", requireAuth, async (req, res) => {
    try {
      const payload = insertStaffSchema.parse(req.body);
      const staff = await storage.createStaff(payload);
      res.status(201).json(staff);
    } catch {
      res.status(400).json({ error: "Invalid team payload" });
    }
  });

  app.patch("/api/staff/:id", requireAuth, async (req, res) => {
    try {
      const staff = await storage.updateStaff(req.params.id, req.body);
      res.json(staff);
    } catch {
      res.status(400).json({ error: "Failed to update team member" });
    }
  });

  app.delete("/api/staff/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteStaff(req.params.id);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete team member" });
    }
  });

  // Compliance
  app.get("/api/compliance/overview", requireAuth, requirePolicy("complianceRecords", "read"), async (_req, res) => {
    try {
      const overview = await buildComplianceOverview();
      res.json(overview);
    } catch {
      res.status(500).json({ error: "Failed to fetch compliance overview" });
    }
  });

  app.get("/api/compliance", requireAuth, requirePolicy("complianceRecords", "read"), async (_req, res) => {
    try {
      const compliance = await storage.getCompliance();
      res.json(compliance);
    } catch {
      res.status(500).json({ error: "Failed to fetch compliance records" });
    }
  });

  app.get("/api/clients/:clientId/compliance", requireAuth, requirePolicy("complianceRecords", "read"), async (req, res) => {
    try {
      const compliance = await storage.getComplianceByClient(req.params.clientId);
      res.json(compliance);
    } catch {
      res.status(500).json({ error: "Failed to fetch client compliance" });
    }
  });

  app.get("/api/compliance/:id", requireAuth, requirePolicy("complianceRecords", "read"), async (req, res) => {
    try {
      const doc = await storage.getComplianceDoc(req.params.id);
      if (!doc) return res.status(404).json({ error: "Compliance record not found" });
      res.json(doc);
    } catch {
      res.status(500).json({ error: "Failed to fetch compliance record" });
    }
  });

  app.post("/api/compliance", requireAuth, requirePolicy("complianceRecords", "write"), async (req, res) => {
    try {
      const payload = insertComplianceSchema.parse(req.body);
      const retentionYears = payload.retentionYears ?? MIN_RECORD_RETENTION_YEARS;
      const now = new Date().toISOString();
      const normalizedPayload = {
        ...payload,
        regulatoryArea: payload.regulatoryArea || deriveComplianceAreaFromType(payload.type),
        jurisdiction: payload.jurisdiction || "Federal",
        retentionYears,
        retentionUntil: payload.retentionUntil || addYearsIso(payload.lastReviewedOn || now, retentionYears),
      };
      const doc = await storage.createCompliance(normalizedPayload);
      await writeAuditLog(req, "compliance", doc.id, "create", {
        type: doc.type,
        regulatoryArea: doc.regulatoryArea,
        status: doc.status,
      });
      res.status(201).json(doc);
    } catch {
      res.status(400).json({ error: "Invalid compliance payload" });
    }
  });

  app.patch("/api/compliance/:id", requireAuth, requirePolicy("complianceRecords", "write"), async (req, res) => {
    try {
      const body = req.body || {};
      const normalizedPayload: Record<string, unknown> = {
        ...body,
        regulatoryArea:
          typeof body.regulatoryArea === "string" && body.regulatoryArea.trim().length
            ? body.regulatoryArea
            : deriveComplianceAreaFromType(body.type),
        jurisdiction:
          typeof body.jurisdiction === "string" && body.jurisdiction.trim().length
            ? body.jurisdiction
            : "Federal",
      };
      if (typeof body.retentionYears === "number") {
        normalizedPayload.retentionYears = body.retentionYears;
      }
      const doc = await storage.updateCompliance(req.params.id, normalizedPayload);
      await writeAuditLog(req, "compliance", doc.id, "update", {
        status: doc.status,
        expires: doc.expires,
        retentionUntil: doc.retentionUntil,
      });
      res.json(doc);
    } catch {
      res.status(400).json({ error: "Failed to update compliance record" });
    }
  });

  app.delete("/api/compliance/:id", requireAuth, requirePolicy("complianceRecords", "delete"), async (req, res) => {
    try {
      await storage.deleteCompliance(req.params.id);
      await writeAuditLog(req, "compliance", req.params.id, "delete");
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete compliance record";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/audit-logs", requireAuth, requirePolicy("auditLogs", "read"), async (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit || "200"), 10);
      const entityType = typeof req.query.entityType === "string" ? req.query.entityType : null;
      const entityId = typeof req.query.entityId === "string" ? req.query.entityId : null;
      if (entityType && entityId) {
        const logs = await storage.getAuditLogsByEntity(entityType, entityId, limit);
        return res.json(logs);
      }
      const logs = await storage.getAuditLogs(limit);
      return res.json(logs);
    } catch {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Inventory
  app.get("/api/inventory/items", requireAuth, async (_req, res) => {
    try {
      const items = await storage.getInventoryItems();
      res.json(items);
    } catch {
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  app.post("/api/inventory/items", requireAuth, async (req, res) => {
    try {
      const payload = insertInventoryItemSchema.parse(req.body);
      const item = await storage.createInventoryItem(payload);
      res.status(201).json(item);
    } catch {
      res.status(400).json({ error: "Invalid inventory item payload" });
    }
  });

  app.patch("/api/inventory/items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.updateInventoryItem(req.params.id, req.body);
      res.json(item);
    } catch {
      res.status(400).json({ error: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/items/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteInventoryItem(req.params.id);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete inventory item" });
    }
  });

  app.get("/api/inventory/lots", requireAuth, async (_req, res) => {
    try {
      const lots = await storage.getInventoryLots();
      res.json(lots);
    } catch {
      res.status(500).json({ error: "Failed to fetch inventory lots" });
    }
  });

  app.get("/api/inventory/lots/:id", requireAuth, async (req, res) => {
    try {
      const lot = await storage.getInventoryLot(req.params.id);
      if (!lot) return res.status(404).json({ error: "Inventory lot not found" });
      res.json(lot);
    } catch {
      res.status(500).json({ error: "Failed to fetch inventory lot" });
    }
  });

  app.post("/api/inventory/lots", requireAuth, async (req, res) => {
    try {
      const payload = insertInventoryLotSchema.parse(req.body);
      const lot = await storage.createInventoryLot(payload);
      await writeAuditLog(req, "inventory_lot", lot.id, "create", {
        lotCode: lot.lotCode,
        itemId: lot.itemId,
        quantity: lot.quantity,
        unitOfMeasure: lot.unitOfMeasure,
      });
      res.status(201).json(lot);
    } catch {
      res.status(400).json({ error: "Invalid inventory lot payload" });
    }
  });

  app.patch("/api/inventory/lots/:id", requireAuth, async (req, res) => {
    try {
      const lot = await storage.updateInventoryLot(req.params.id, req.body);
      await writeAuditLog(req, "inventory_lot", lot.id, "update", {
        lotCode: lot.lotCode,
        quantity: lot.quantity,
        locationId: lot.locationId,
      });
      res.json(lot);
    } catch {
      res.status(400).json({ error: "Failed to update inventory lot" });
    }
  });

  app.delete("/api/inventory/lots/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteInventoryLot(req.params.id);
      await writeAuditLog(req, "inventory_lot", req.params.id, "delete");
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete inventory lot" });
    }
  });

  app.get("/api/inventory/movements", requireAuth, async (_req, res) => {
    try {
      const movements = await storage.getInventoryMovements();
      res.json(movements);
    } catch {
      res.status(500).json({ error: "Failed to fetch inventory movements" });
    }
  });

  app.post("/api/inventory/movements", requireAuth, async (req, res) => {
    try {
      const payload = insertInventoryMovementSchema.parse(req.body);
      const lot = await storage.getInventoryLot(payload.lotId);
      if (!lot) return res.status(404).json({ error: "Inventory lot not found" });

      const prepared = prepareInventoryMovementForLot(lot, payload, req.session.user?.name || null);
      const movement = await storage.createInventoryMovement(prepared.movement);
      if (prepared.lotUpdates) {
        await storage.updateInventoryLot(lot.id, prepared.lotUpdates);
      }

      await writeAuditLog(req, "inventory_movement", movement.id, "create", {
        lotId: movement.lotId,
        movementType: movement.movementType,
        quantity: movement.quantity,
        beforeQuantity: prepared.before.quantity,
        afterQuantity: prepared.after.quantity,
        beforeLocationId: prepared.before.locationId,
        afterLocationId: prepared.after.locationId,
        ttbOperationCategory: movement.ttbOperationCategory,
        productionStage: movement.productionStage,
        taxClassification: movement.taxClassification,
        lotSynchronized: Boolean(prepared.lotUpdates),
      });
      res.status(201).json(movement);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid inventory movement payload";
      res.status(400).json({ error: message });
    }
  });

  // Barrel management
  app.get("/api/barrels", requireAuth, async (_req, res) => {
    try {
      const barrels = await storage.getBarrels();
      res.json(barrels);
    } catch {
      res.status(500).json({ error: "Failed to fetch barrels" });
    }
  });

  app.get("/api/barrels/:id", requireAuth, async (req, res) => {
    try {
      const barrel = await storage.getBarrel(req.params.id);
      if (!barrel) return res.status(404).json({ error: "Barrel not found" });
      res.json(barrel);
    } catch {
      res.status(500).json({ error: "Failed to fetch barrel" });
    }
  });

  app.post("/api/barrels", requireAuth, async (req, res) => {
    try {
      const payload = insertBarrelSchema.parse(req.body);
      const barrel = await storage.createBarrel(payload);
      res.status(201).json(barrel);
    } catch {
      res.status(400).json({ error: "Invalid barrel payload" });
    }
  });

  app.patch("/api/barrels/:id", requireAuth, async (req, res) => {
    try {
      const barrel = await storage.updateBarrel(req.params.id, req.body);
      res.json(barrel);
    } catch {
      res.status(400).json({ error: "Failed to update barrel" });
    }
  });

  app.delete("/api/barrels/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteBarrel(req.params.id);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete barrel" });
    }
  });

  app.get("/api/barrels/:id/events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getBarrelEvents(req.params.id);
      res.json(events);
    } catch {
      res.status(500).json({ error: "Failed to fetch barrel events" });
    }
  });

  app.post("/api/barrels/:id/events", requireAuth, async (req, res) => {
    try {
      const barrel = await storage.getBarrel(req.params.id);
      if (!barrel) return res.status(404).json({ error: "Barrel not found" });

      const payload = insertBarrelEventSchema.parse({ ...req.body, barrelId: req.params.id });
      const prepared = prepareBarrelEventForBarrel(barrel, payload, req.session.user?.name || null);
      const event = await storage.createBarrelEvent(prepared.event);
      if (prepared.barrelUpdates) {
        await storage.updateBarrel(barrel.id, prepared.barrelUpdates);
      }

      await writeAuditLog(req, "barrel_event", event.id, "create", {
        barrelId: event.barrelId,
        eventType: event.eventType,
        eventAt: event.eventAt,
        beforeCurrentVolume: prepared.before.currentVolume,
        afterCurrentVolume: prepared.after.currentVolume,
        beforeStatus: prepared.before.status,
        afterStatus: prepared.after.status,
        beforeLocationId: prepared.before.locationId,
        afterLocationId: prepared.after.locationId,
        ttbOperationCategory: event.ttbOperationCategory,
        productionStage: event.productionStage,
        taxClassification: event.taxClassification,
        barrelSynchronized: Boolean(prepared.barrelUpdates),
      });
      res.status(201).json(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid barrel event payload";
      res.status(400).json({ error: message });
    }
  });

  // TTB reports
  app.get("/api/reports/ttb", requireAuth, requirePolicy("ttbReports", "read"), async (_req, res) => {
    try {
      const reports = await storage.getTtbReports();
      res.json(reports);
    } catch {
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.get("/api/reports/ttb/:id", requireAuth, requirePolicy("ttbReports", "read"), async (req, res) => {
    try {
      const report = await storage.getTtbReport(req.params.id);
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json(report);
    } catch {
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  app.post("/api/reports/ttb", requireAuth, requirePolicy("ttbReports", "write"), async (req, res) => {
    try {
      const payload = createTtbReportRequestSchema.parse(req.body);
      const filingCadence = payload.filingCadence || deriveCadenceFromPeriod(payload.reportPeriodStart, payload.reportPeriodEnd);
      const dueDate = payload.dueDate || defaultDueDateForCadence(payload.reportPeriodEnd, filingCadence);
      const reportPayload = await buildTtbMonthlyPayload(payload.reportPeriodStart, payload.reportPeriodEnd, {
        filingType: payload.filingType || null,
        exciseTaxDue: payload.exciseTaxDue ?? null,
      });
      const now = new Date().toISOString();
      const retentionUntil = payload.retentionUntil || addYearsIso(now, MIN_RECORD_RETENTION_YEARS);
      const enrichedPayload = {
        ...reportPayload,
        complianceEnvelope: {
          filingType: payload.filingType || "Storage Operations",
          filingCadence,
          dueDate,
          retentionPolicyYears: MIN_RECORD_RETENTION_YEARS,
          retentionUntil,
        },
      };
      const report = await storage.createTtbReport({
        reportPeriodStart: payload.reportPeriodStart,
        reportPeriodEnd: payload.reportPeriodEnd,
        filingType: payload.filingType || null,
        exciseTaxDue: payload.exciseTaxDue ?? null,
        filingCadence,
        dueDate,
        retentionUntil,
        payload: enrichedPayload,
        status: "Generated",
        generatedAt: now,
      });
      await writeAuditLog(req, "ttb_report", report.id, "create", {
        filingType: report.filingType,
        filingCadence: report.filingCadence,
        dueDate: report.dueDate,
        status: report.status,
      });
      res.status(201).json(report);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid report payload";
      res.status(400).json({ error: message });
    }
  });

  app.patch("/api/reports/ttb/:id", requireAuth, requirePolicy("ttbReports", "write"), async (req, res) => {
    try {
      const body = updateTtbReportRequestSchema.parse(req.body || {});
      const requestedCadence = body.filingCadence || null;
      if (
        requestedCadence &&
        !ttbFilingCadences.includes(requestedCadence as (typeof ttbFilingCadences)[number])
      ) {
        return res.status(400).json({ error: "Invalid filing cadence" });
      }
      const updates: {
        filingType?: z.infer<typeof updateTtbReportRequestSchema>["filingType"];
        filingCadence?: z.infer<typeof updateTtbReportRequestSchema>["filingCadence"];
        dueDate?: string | null;
        exciseTaxDue?: number | null;
        retentionUntil?: string | null;
      } = {};
      if (body.filingType !== undefined) updates.filingType = body.filingType;
      if (body.filingCadence !== undefined) updates.filingCadence = body.filingCadence;
      if (body.dueDate !== undefined) updates.dueDate = body.dueDate || null;
      if (body.exciseTaxDue !== undefined) updates.exciseTaxDue = body.exciseTaxDue ?? null;
      if (body.retentionUntil !== undefined) updates.retentionUntil = body.retentionUntil || null;

      const report = await storage.updateTtbReport(req.params.id, updates);
      await writeAuditLog(req, "ttb_report", report.id, "update", {
        filingCadence: report.filingCadence,
        dueDate: report.dueDate,
        status: report.status,
      });
      res.json(report);
    } catch {
      res.status(400).json({ error: "Failed to update report" });
    }
  });

  app.post("/api/reports/ttb/:id/approve", requireAuth, requirePolicy("ttbReportApproval", "approve"), async (req, res) => {
    try {
      const actor = req.session.user;
      if (!actor) return res.status(401).json({ error: "Authentication required" });
      const report = await storage.updateTtbReport(req.params.id, {
        status: "Approved",
        approvedAt: new Date().toISOString(),
        approvedBy: actor.name,
      });
      await writeAuditLog(req, "ttb_report", report.id, "approve", {
        approvedBy: report.approvedBy,
      });
      res.json(report);
    } catch {
      res.status(400).json({ error: "Failed to approve report" });
    }
  });

  app.post("/api/reports/ttb/:id/export", requireAuth, requirePolicy("ttbReportExport", "export"), async (req, res) => {
    try {
      const actor = req.session.user;
      if (!actor) return res.status(401).json({ error: "Authentication required" });
      const report = await storage.getTtbReport(req.params.id);
      if (!report) return res.status(404).json({ error: "Report not found" });
      if (report.status !== "Approved" && actor.role !== "admin") {
        return res.status(400).json({ error: "Report must be approved before export" });
      }

      const exportDir = path.join(process.cwd(), "exports", "ttb");
      ensureDirectory(exportDir);
      const baseName = `${report.id}-${Date.now()}`;
      const jsonPath = path.join(exportDir, `${baseName}.json`);
      const csvPath = path.join(exportDir, `${baseName}.csv`);
      const pdfPath = path.join(exportDir, `${baseName}.pdf`);

      fs.writeFileSync(jsonPath, JSON.stringify(report.payload, null, 2), "utf8");
      fs.writeFileSync(csvPath, toCsv(report.payload), "utf8");

      const pdfLines = buildTtbPacketPdfLines(report, report.payload);
      fs.writeFileSync(pdfPath, toTextPdf(pdfLines));

      const updated = await storage.updateTtbReport(report.id, {
        status: "Exported",
        exportedAt: new Date().toISOString(),
        jsonPath: path.relative(process.cwd(), jsonPath),
        csvPath: path.relative(process.cwd(), csvPath),
        pdfPath: path.relative(process.cwd(), pdfPath),
      });
      await writeAuditLog(req, "ttb_report", updated.id, "export", {
        jsonPath: updated.jsonPath,
        csvPath: updated.csvPath,
        pdfPath: updated.pdfPath,
      });

      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to export report" });
    }
  });

  app.delete("/api/reports/ttb/:id", requireAuth, requirePolicy("ttbReports", "delete"), async (req, res) => {
    try {
      await storage.deleteTtbReport(req.params.id);
      await writeAuditLog(req, "ttb_report", req.params.id, "delete");
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete report";
      res.status(400).json({ error: message });
    }
  });

  // Sales orders
  app.get("/api/sales-orders", requireAuth, requirePolicy("salesOrders", "read"), async (_req, res) => {
    try {
      const orders = await storage.getSalesOrders();
      res.json(orders);
    } catch {
      res.status(500).json({ error: "Failed to fetch sales orders" });
    }
  });

  app.get("/api/sales-orders/:id", requireAuth, requirePolicy("salesOrders", "read"), async (req, res) => {
    try {
      const order = await storage.getSalesOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Sales order not found" });
      res.json(order);
    } catch {
      res.status(500).json({ error: "Failed to fetch sales order" });
    }
  });

  app.post("/api/sales-orders", requireAuth, requirePolicy("salesOrders", "write"), async (req, res) => {
    try {
      const payload = insertSalesOrderSchema.parse(req.body);
      const order = await storage.createSalesOrder(payload);
      res.status(201).json(order);
    } catch {
      res.status(400).json({ error: "Invalid sales order payload" });
    }
  });

  app.patch("/api/sales-orders/:id", requireAuth, requirePolicy("salesOrders", "write"), async (req, res) => {
    try {
      const order = await storage.updateSalesOrder(req.params.id, req.body);
      res.json(order);
    } catch {
      res.status(400).json({ error: "Failed to update sales order" });
    }
  });

  app.delete("/api/sales-orders/:id", requireAuth, requirePolicy("salesOrders", "delete"), async (req, res) => {
    try {
      await storage.deleteSalesOrder(req.params.id);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete sales order" });
    }
  });

  // Native calculator + presets
  app.get("/api/calculator/presets", requireAuth, async (_req, res) => {
    try {
      const presets = await storage.getCalculatorPresets();
      res.json(presets);
    } catch {
      res.status(500).json({ error: "Failed to fetch calculator presets" });
    }
  });

  app.post("/api/calculator/presets", requireAuth, async (req, res) => {
    try {
      const payload = insertCalculatorPresetSchema.parse(req.body);
      const preset = await storage.createCalculatorPreset(payload);
      res.status(201).json(preset);
    } catch {
      res.status(400).json({ error: "Invalid calculator preset payload" });
    }
  });

  app.patch("/api/calculator/presets/:id", requireAuth, async (req, res) => {
    try {
      const preset = await storage.updateCalculatorPreset(req.params.id, req.body);
      res.json(preset);
    } catch {
      res.status(400).json({ error: "Failed to update calculator preset" });
    }
  });

  app.delete("/api/calculator/presets/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCalculatorPreset(req.params.id);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete calculator preset" });
    }
  });

  app.post("/api/calculator/compute", requireAuth, async (req, res) => {
    try {
      const payload = calculatorComputeSchema.parse(req.body);
      const output = runCalculator(payload.calculationType, payload.inputs);
      res.json(output);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid calculator payload";
      res.status(400).json({ error: message });
    }
  });

  // Job photos
  app.get("/api/jobs/:id/photos", requireAuth, requirePolicy("jobPhotos", "read"), async (req, res) => {
    try {
      const photos = await storage.getJobPhotos(req.params.id);
      res.json(photos);
    } catch {
      res.status(500).json({ error: "Failed to fetch job photos" });
    }
  });

  app.post("/api/jobs/:id/photos", requireAuth, requirePolicy("jobPhotos", "upload"), async (req, res) => {
    try {
      const { filename, dataUrl } = req.body;
      if (!filename || !dataUrl) return res.status(400).json({ error: "filename and dataUrl are required" });

      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Batch not found" });

      const uploadsDir = path.join(process.cwd(), "uploads", "job-photos");
      ensureDirectory(uploadsDir);

      const parsedDataUrl = parseBase64DataUrl(String(dataUrl));
      if (!parsedDataUrl) return res.status(400).json({ error: "Invalid dataUrl format" });

      const uploadValidation = assertAllowedUpload({
        mimeType: parsedDataUrl.mimeType,
        buffer: parsedDataUrl.buffer,
        maxBytes: MAX_JOB_PHOTO_BYTES,
        allowedMimeTypes: ALLOWED_JOB_PHOTO_MIME_TYPES,
      });
      if (!uploadValidation.ok) {
        return res.status(400).json({ error: uploadValidation.reason });
      }

      const safeOriginal = sanitizeUploadFilename(String(filename), "photo");
      const originalStem = path.parse(safeOriginal).name || "photo";
      const extension =
        extensionForMimeType(parsedDataUrl.mimeType) || path.extname(safeOriginal).toLowerCase() || ".bin";
      const storedFilename = `${originalStem.slice(0, 120)}${extension}`;
      const uniqueFilename = `${req.params.id}-${Date.now()}-${storedFilename}`;
      const filePath = path.join(uploadsDir, uniqueFilename);
      fs.writeFileSync(filePath, parsedDataUrl.buffer, { flag: "wx" });

      const uploadedBy = req.session.user?.name || "Unknown";
      const photo = await storage.addJobPhoto({
        jobId: req.params.id,
        filename: safeOriginal,
        filePath: `/uploads/job-photos/${uniqueFilename}`,
        uploadedBy,
      });
      res.status(201).json(photo);
    } catch {
      res.status(400).json({ error: "Failed to upload photo" });
    }
  });

  app.delete("/api/jobs/:jobId/photos/:photoId", requireAuth, requirePolicy("jobPhotos", "delete"), async (req, res) => {
    try {
      await storage.deleteJobPhoto(req.params.photoId);
      res.status(204).send();
    } catch {
      res.status(400).json({ error: "Failed to delete photo" });
    }
  });

  // Decommissioned integration APIs
  app.all("/api/integrations/*", (_req, res) => {
    res.status(410).json({ error: "Integration APIs are decommissioned in this release." });
  });

  app.all("/api/automations*", (_req, res) => {
    res.status(410).json({ error: "Automation APIs are decommissioned in this release." });
  });

  const authenticatedStaticOptions = {
    dotfiles: "deny" as const,
    index: false,
    setHeaders: (res: Response, filePath: string) => {
      const safeName = path.basename(filePath).replace(/"/g, "");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    },
  };

  // Protect generated and uploaded artifacts behind authentication.
  app.use("/uploads", requireAuth, express.static("uploads", authenticatedStaticOptions));
  app.use("/exports", requireAuth, express.static("exports", authenticatedStaticOptions));

  return httpServer;
}
