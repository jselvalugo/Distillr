import {
  type Job,
  type InsertJob,
  type Client,
  type InsertClient,
  type Property,
  type InsertProperty,
  type Staff,
  type InsertStaff,
  type Compliance,
  type InsertCompliance,
  type Stats,
  type JobPhoto,
  type InsertJobPhoto,
  type Attachment,
  type InsertAttachment,
  type AttachmentLink,
  type InsertAttachmentLink,
  type PlatformConfig,
  type UpdatePlatformConfig,
  type InventoryItem,
  type InsertInventoryItem,
  type InventoryLot,
  type InsertInventoryLot,
  type InventoryMovement,
  type InsertInventoryMovement,
  type Barrel,
  type InsertBarrel,
  type BarrelEvent,
  type InsertBarrelEvent,
  type TtbReport,
  type InsertTtbReport,
  type AuditLog,
  type InsertAuditLog,
  type SalesOrder,
  type InsertSalesOrder,
  type CalculatorPreset,
  type InsertCalculatorPreset,
  type DistillingBatchRecord,
  type InsertDistillingBatchRecord,
  type DistillingProductionRecord,
  type InsertDistillingProductionRecord,
  type DistillingInventoryRecord,
  type InsertDistillingInventoryRecord,
  type DistillingCasesMade,
  type DistillingCasesToDistributors,
  type DistillingCasesToRetail,
  type DistillingBottlesMade,
  type DistilleryControlTowerSummary,
  defaultPlatformConfig,
} from "@shared/schema";
import { query } from "./db";
import { getCurrentTenantId } from "./tenant-context";
import {
  MIN_RECORD_RETENTION_YEARS,
  addYearsIso,
  defaultDueDateForCadence,
  deriveCadenceFromPeriod,
  deriveComplianceAreaFromType,
  isRetentionLocked,
} from "./compliance-policy";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNullableText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toFiniteNumber(value, fallback));
}

function roundNumber(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

const DEFAULT_US_GALLONS_PER_CASE = roundNumber((12 * 750 * 0.0002641720524), 6); // 12x750mL
const DEFAULT_PROOF_GALLONS_PER_CASE = roundNumber(DEFAULT_US_GALLONS_PER_CASE * 0.4, 6); // Assumes 40% ABV average

const ZERO_DISTILLING_CASES_MADE: DistillingCasesMade = {
  pitorro: 0,
  pitorroDeCafe: 0,
  pitorroCoconut: 0,
  pitorroCitrus: 0,
  libertalia: 0,
  oakAgedLibertalia: 0,
  riskey: 0,
  riskeyBarrelStrength: 0,
  coquito: 0,
  lugosCraftLibations: 0,
  yoHo: 0,
};

const ZERO_DISTILLING_CASES_TO_DISTRIBUTORS: DistillingCasesToDistributors = {
  pitorro: 0,
  pitorroDeCafe: 0,
  pitorroCoconut: 0,
  pitorroCitrus: 0,
  libertalia: 0,
  riskey: 0,
  riskeyBarrelStrength: 0,
  coquito: 0,
  lugosCraftLibations: 0,
  yoHo: 0,
};

const ZERO_DISTILLING_CASES_TO_RETAIL: DistillingCasesToRetail = {
  pitorro: 0,
  pitorroDeCafe: 0,
  pitorroCoconut: 0,
  pitorroCitrus: 0,
  libertalia: 0,
  oakAgedLibertalia: 0,
  riskey: 0,
  riskeyBarrelStrength: 0,
  coquito: 0,
};

const ZERO_DISTILLING_BOTTLES_MADE: DistillingBottlesMade = {
  pitorro: 0,
  pitorroDeCafe: 0,
  pitorroCoconut: 0,
  libertalia: 0,
  oakAgedLibertalia: 0,
  riskey: 0,
};

function normalizeNumericRecord<T extends Record<string, number>>(value: unknown, defaults: T): T {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const entries = Object.keys(defaults).map((key) => [key, Math.max(0, toInt(source[key], defaults[key]))]);
  return Object.fromEntries(entries) as T;
}

function sumNumericRecord(value: Record<string, number>): number {
  return Object.values(value).reduce((sum, count) => sum + toInt(count, 0), 0);
}

const WEEK_KEY_PATTERN = /^(\d{4})-W(\d{1,2})$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + (days * DAY_MS));
}

function startOfIsoWeek(date: Date): Date {
  const day = date.getUTCDay() || 7; // Sunday (0) => 7
  return addUtcDays(date, 1 - day);
}

function getIsoWeekParts(date: Date): { isoYear: number; isoWeek: number } {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day); // Thursday anchors ISO year
  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return { isoYear, isoWeek };
}

function getIsoWeekKey(date: Date): string {
  const { isoYear, isoWeek } = getIsoWeekParts(date);
  return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}

function parseWeekKey(value: string): { canonical: string; start: Date; endExclusive: Date } | null {
  const match = WEEK_KEY_PATTERN.exec(value.trim());
  if (!match) return null;
  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);
  if (!Number.isInteger(isoYear) || !Number.isInteger(isoWeek) || isoWeek < 1 || isoWeek > 53) return null;

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week1Start = startOfIsoWeek(jan4);
  const start = addUtcDays(week1Start, (isoWeek - 1) * 7);
  const canonical = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
  if (getIsoWeekKey(start) !== canonical) return null;

  return {
    canonical,
    start,
    endExclusive: addUtcDays(start, 7),
  };
}

function currentReportMonth(): string {
  return getIsoWeekKey(new Date());
}

function normalizeReportMonth(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return currentReportMonth();
  const week = parseWeekKey(trimmed);
  if (week) return week.canonical;
  throw new Error("Report week must be in YYYY-Www format");
}

function isDateWithinReportPeriod(value: string | null | undefined, reportPeriod: string): boolean {
  const date = parseIsoDateOnly(value);
  if (!date) return false;

  const week = parseWeekKey(reportPeriod);
  if (!week) return false;
  return date >= week.start && date < week.endExclusive;
}

function computeProofOfGallons(gallonsDistilled: number, percentageDistilled: number): number {
  return roundNumber(Math.max(0, gallonsDistilled) * (Math.max(0, percentageDistilled) / 100), 2);
}

function computeDistillingInventoryDerived(input: {
  beginningOfMonthCases: number;
  casesMade: DistillingCasesMade;
  casesToDistributors: DistillingCasesToDistributors;
  casesToRetail: DistillingCasesToRetail;
}): Pick<
  DistillingInventoryRecord,
  "currentMonthInventory" | "endingMonthInventory" | "endingUsGallons" | "endingProofGallons"
> {
  const totalCasesMade = sumNumericRecord(input.casesMade);
  const totalDistributorCases = sumNumericRecord(input.casesToDistributors);
  const totalRetailCases = sumNumericRecord(input.casesToRetail);
  const soldCases = totalDistributorCases + totalRetailCases;
  const currentMonthInventory = Math.max(0, toInt(input.beginningOfMonthCases) + totalCasesMade - soldCases);
  const endingMonthInventory = currentMonthInventory;

  return {
    currentMonthInventory,
    endingMonthInventory,
    // Uses default case conversion assumptions until per-SKU proof/size configuration is added.
    endingUsGallons: roundNumber(endingMonthInventory * DEFAULT_US_GALLONS_PER_CASE, 2),
    endingProofGallons: roundNumber(endingMonthInventory * DEFAULT_PROOF_GALLONS_PER_CASE, 2),
  };
}

const DISTILLING_BATCH_STAGE_ORDER: DistillingBatchRecord["stage"][] = [
  "Production",
  "Processing",
  "Bottling",
  "Sales",
];

function stageOrderValue(stage: DistillingBatchRecord["stage"]): number {
  const index = DISTILLING_BATCH_STAGE_ORDER.indexOf(stage);
  return index === -1 ? 0 : index;
}

function mergeBatchStage(
  currentStage: DistillingBatchRecord["stage"],
  minimumStage: DistillingBatchRecord["stage"],
): DistillingBatchRecord["stage"] {
  return stageOrderValue(currentStage) >= stageOrderValue(minimumStage) ? currentStage : minimumStage;
}

function computeBatchWorkflowAfterInventory(
  batch: DistillingBatchRecord,
  soldCases: number,
): Pick<DistillingBatchRecord, "stage" | "status"> {
  const targetStage: DistillingBatchRecord["stage"] = soldCases > 0 ? "Sales" : "Bottling";
  const nextStage = mergeBatchStage(batch.stage, targetStage);

  let nextStatus = batch.status;
  if (nextStatus === "Draft") nextStatus = "In Progress";
  if (soldCases > 0 && (batch.status === "Draft" || batch.status === "In Progress")) {
    nextStatus = "Completed";
  }

  return {
    stage: nextStage,
    status: nextStatus,
  };
}

function computeInventoryCasesDrawGallons(casesMade: DistillingCasesMade): number {
  const totalCasesMade = sumNumericRecord(casesMade);
  return roundNumber(Math.max(0, totalCasesMade) * DEFAULT_US_GALLONS_PER_CASE, 2);
}

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    address: String(row.address),
    service: String(row.service),
    serviceCategory: toNullableText(row.service_category),
    status: row.status as Job["status"],
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    crew: toStringArray(row.crew),
    priority: row.priority as Job["priority"],
    blockReason: toNullableText(row.block_reason) || undefined,
    scheduledDate: String(row.scheduled_date),
    assignedUserId: toNullableText(row.assigned_user_id),
    workOrderNumber: toNullableText(row.work_order_number),
    estimatedMinutes: row.estimated_minutes === null ? null : Number(row.estimated_minutes),
    completionNotes: toNullableText(row.completion_notes),
    afterPhotos: toStringArray(row.after_photos),
  };
}

function mapClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    name: String(row.name),
    legalName: toNullableText(row.legal_name),
    dba: toNullableText(row.dba),
    type: String(row.type),
    contact: String(row.contact),
    contactTitle: toNullableText(row.contact_title),
    contactEmail: toNullableText(row.contact_email),
    contactPhone: toNullableText(row.contact_phone),
    accountOwner: toNullableText(row.account_owner),
    status: String(row.status),
    website: toNullableText(row.website),
    supportEmail: toNullableText(row.support_email),
    supportPhone: toNullableText(row.support_phone),
    billingAddress: toNullableText(row.billing_address),
    headquartersAddress: toNullableText(row.headquarters_address),
    paymentTerms: toNullableText(row.payment_terms),
    taxId: toNullableText(row.tax_id),
    industrySegment: toNullableText(row.industry_segment),
    accountTier: toNullableText(row.account_tier),
    onboardingStatus: toNullableText(row.onboarding_status),
    renewalDate: toNullableText(row.renewal_date),
    notes: toNullableText(row.notes),
    coiExpiresOn: toNullableText(row.coi_expires_on),
    serviceAgreementExpiresOn: toNullableText(row.service_agreement_expires_on),
  };
}

function mapProperty(row: Record<string, unknown>): Property {
  return {
    id: String(row.id),
    name: String(row.name),
    address: String(row.address),
    clientId: String(row.client_id),
    type: toNullableText(row.type),
    status: toNullableText(row.status),
    region: toNullableText(row.region),
    siteContact: toNullableText(row.site_contact),
    siteContactPhone: toNullableText(row.site_contact_phone),
    accessNotes: toNullableText(row.access_notes),
  };
}

function mapStaff(row: Record<string, unknown>): Staff {
  return {
    id: String(row.id),
    name: String(row.name),
    role: String(row.role),
    status: String(row.status),
    phone: String(row.phone),
    userId: toNullableText(row.user_id),
  };
}

function mapCompliance(row: Record<string, unknown>): Compliance {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    type: String(row.type),
    regulatoryArea: toNullableText(row.regulatory_area),
    jurisdiction: toNullableText(row.jurisdiction),
    controlReference: toNullableText(row.control_reference),
    status: String(row.status),
    expires: toNullableText(row.expires),
    documentUrl: toNullableText(row.document_url),
    owner: toNullableText(row.owner),
    severity: toNullableText(row.severity),
    requiredFor: toNullableText(row.required_for),
    lastReviewedOn: toNullableText(row.last_reviewed_on),
    retentionYears: row.retention_years === null ? null : Number(row.retention_years),
    retentionUntil: toNullableText(row.retention_until),
    createdAt: toNullableText(row.created_at),
    updatedAt: toNullableText(row.updated_at),
  };
}

function mapInventoryItem(row: Record<string, unknown>): InventoryItem {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    unitOfMeasure: String(row.unit_of_measure),
    status: row.status as InventoryItem["status"],
    notes: toNullableText(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapInventoryLot(row: Record<string, unknown>): InventoryLot {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    batchId: toNullableText(row.batch_id),
    lotCode: String(row.lot_code),
    quantity: Number(row.quantity),
    unitOfMeasure: String(row.unit_of_measure),
    abv: row.abv === null ? null : Number(row.abv),
    proofGallons: row.proof_gallons === null ? null : Number(row.proof_gallons),
    locationId: toNullableText(row.location_id),
    receivedAt: toNullableText(row.received_at),
    expiresAt: toNullableText(row.expires_at),
    notes: toNullableText(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapInventoryMovement(row: Record<string, unknown>): InventoryMovement {
  return {
    id: String(row.id),
    lotId: String(row.lot_id),
    movementType: row.movement_type as InventoryMovement["movementType"],
    quantity: Number(row.quantity),
    ttbOperationCategory: toNullableText(row.ttb_operation_category) as InventoryMovement["ttbOperationCategory"],
    productionStage: toNullableText(row.production_stage) as InventoryMovement["productionStage"],
    taxClassification: toNullableText(row.tax_classification) as InventoryMovement["taxClassification"],
    fromLocationId: toNullableText(row.from_location_id),
    toLocationId: toNullableText(row.to_location_id),
    reason: toNullableText(row.reason),
    performedBy: toNullableText(row.performed_by),
    performedAt: String(row.performed_at),
    metadata: (row.metadata || {}) as Record<string, unknown>,
  };
}

function mapBarrel(row: Record<string, unknown>): Barrel {
  return {
    id: String(row.id),
    serialNumber: String(row.serial_number),
    productName: toNullableText(row.product_name),
    fillDate: toNullableText(row.fill_date),
    fillProof: row.fill_proof === null ? null : Number(row.fill_proof),
    fillProofGallons: row.fill_proof_gallons === null ? null : Number(row.fill_proof_gallons),
    fillVolume: row.fill_volume === null ? null : Number(row.fill_volume),
    currentVolume: row.current_volume === null ? null : Number(row.current_volume),
    currentProofGallons: row.current_proof_gallons === null ? null : Number(row.current_proof_gallons),
    totalAgingDays: row.total_aging_days === null ? null : Number(row.total_aging_days),
    dumpDate: toNullableText(row.dump_date),
    casesMade: row.cases_made === null ? null : Number(row.cases_made),
    percentBottled: row.percent_bottled === null ? null : Number(row.percent_bottled),
    lossesProofGallons: row.losses_proof_gallons === null ? null : Number(row.losses_proof_gallons),
    status: row.status as Barrel["status"],
    locationId: toNullableText(row.location_id),
    warehouseZone: toNullableText(row.warehouse_zone),
    charLevel: toNullableText(row.char_level),
    originBatchId: toNullableText(row.origin_batch_id),
    colorNotes: toNullableText(row.color_notes),
    noseNotes: toNullableText(row.nose_notes),
    samplePercentNotes: toNullableText(row.sample_percent_notes),
    outdoorTemp: toNullableText(row.outdoor_temp),
    notes: toNullableText(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapBarrelEvent(row: Record<string, unknown>): BarrelEvent {
  return {
    id: String(row.id),
    barrelId: String(row.barrel_id),
    eventType: row.event_type as BarrelEvent["eventType"],
    eventAt: String(row.event_at),
    volumeChange: row.volume_change === null ? null : Number(row.volume_change),
    proofAtEvent: row.proof_at_event === null ? null : Number(row.proof_at_event),
    outdoorTemp: row.outdoor_temp === null || row.outdoor_temp === undefined ? null : Number(row.outdoor_temp),
    wineGallons: row.wine_gallons === null || row.wine_gallons === undefined ? null : Number(row.wine_gallons),
    ttbOperationCategory: toNullableText(row.ttb_operation_category) as BarrelEvent["ttbOperationCategory"],
    productionStage: toNullableText(row.production_stage) as BarrelEvent["productionStage"],
    taxClassification: toNullableText(row.tax_classification) as BarrelEvent["taxClassification"],
    fromLocationId: toNullableText(row.from_location_id),
    toLocationId: toNullableText(row.to_location_id),
    notes: toNullableText(row.notes),
    performedBy: toNullableText(row.performed_by),
    metadata: (row.metadata || {}) as Record<string, unknown>,
  };
}

function mapTtbReport(row: Record<string, unknown>): TtbReport {
  return {
    id: String(row.id),
    reportPeriodStart: String(row.report_period_start),
    reportPeriodEnd: String(row.report_period_end),
    filingType: toNullableText(row.filing_type) as TtbReport["filingType"],
    filingCadence: toNullableText(row.filing_cadence) as TtbReport["filingCadence"],
    dueDate: toNullableText(row.due_date),
    exciseTaxDue: row.excise_tax_due === null ? null : Number(row.excise_tax_due),
    status: row.status as TtbReport["status"],
    generatedAt: toNullableText(row.generated_at),
    approvedAt: toNullableText(row.approved_at),
    approvedBy: toNullableText(row.approved_by),
    exportedAt: toNullableText(row.exported_at),
    retentionUntil: toNullableText(row.retention_until),
    payload: (row.payload || {}) as Record<string, unknown>,
    jsonPath: toNullableText(row.json_path),
    csvPath: toNullableText(row.csv_path),
    pdfPath: toNullableText(row.pdf_path),
  };
}

function mapAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    action: String(row.action),
    actorName: toNullableText(row.actor_name),
    actorRole: toNullableText(row.actor_role),
    occurredAt: String(row.occurred_at),
    details: (row.details || {}) as Record<string, unknown>,
  };
}

function mapSalesOrder(row: Record<string, unknown>): SalesOrder {
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    clientId: String(row.client_id),
    status: row.status as SalesOrder["status"],
    orderDate: String(row.order_date),
    requestedShipDate: toNullableText(row.requested_ship_date),
    fulfilledDate: toNullableText(row.fulfilled_date),
    totalAmount: row.total_amount === null ? null : Number(row.total_amount),
    currency: String(row.currency),
    notes: toNullableText(row.notes),
    lineItems: Array.isArray(row.line_items) ? (row.line_items as SalesOrder["lineItems"]) : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCalculatorPreset(row: Record<string, unknown>): CalculatorPreset {
  const parameters = row.parameters && typeof row.parameters === "object" ? (row.parameters as Record<string, unknown>) : {};
  return {
    id: String(row.id),
    name: String(row.name),
    calculationType: String(row.calculation_type) as CalculatorPreset["calculationType"],
    parameters: Object.fromEntries(
      Object.entries(parameters).map(([key, value]) => [key, Number(value)]),
    ),
    notes: toNullableText(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDistillingBatchRecord(row: Record<string, unknown>): DistillingBatchRecord {
  return {
    id: String(row.id),
    batchCode: String(row.batch_code),
    batchDate: String(row.batch_date),
    stage: String(row.stage) as DistillingBatchRecord["stage"],
    status: String(row.status) as DistillingBatchRecord["status"],
    productionRecordId: toNullableText(row.production_record_id),
    inventoryRecordId: toNullableText(row.inventory_record_id),
    salesOrderId: toNullableText(row.sales_order_id),
    notes: toNullableText(row.notes),
    productName: toNullableText(row.product_name),
    barrelId: toNullableText(row.barrel_id),
    spiritType: toNullableText(row.spirit_type),
    spiritClass: toNullableText(row.spirit_class),
    distillationProof: toFiniteNumber(row.distillation_proof),
    proofGallonsProduced: toFiniteNumber(row.proof_gallons_produced),
    stillType: toNullableText(row.still_type),
    fillNumber: toNullableText(row.fill_number),
    fillProof: toFiniteNumber(row.fill_proof),
    fillWineGallons: toFiniteNumber(row.fill_wine_gallons),
    fillProofGallons: toFiniteNumber(row.fill_proof_gallons),
    containerType: toNullableText(row.container_type),
    bottlingDate: toNullableText(row.bottling_date),
    bottlingProof: toFiniteNumber(row.bottling_proof),
    wineGallonsBottled: toFiniteNumber(row.wine_gallons_bottled),
    proofGallonsProcessed: toFiniteNumber(row.proof_gallons_processed),
    cases750ml: row.cases_750ml != null ? Number(row.cases_750ml) : null,
    cases1000ml: row.cases_1000ml != null ? Number(row.cases_1000ml) : null,
    cases1750ml: row.cases_1750ml != null ? Number(row.cases_1750ml) : null,
    totalCases: row.total_cases != null ? Number(row.total_cases) : null,
    lotNumber: toNullableText(row.lot_number),
    taxClass: toNullableText(row.tax_class),
    exciseTaxDue: toFiniteNumber(row.excise_tax_due),
    distillDate: toNullableText(row.distill_date),
    fillDate: toNullableText(row.fill_date),
    targetDumpDate: toNullableText(row.target_dump_date),
    amountReceivedGallons: toFiniteNumber(row.amount_received_gallons),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDistillingProductionRecord(row: Record<string, unknown>): DistillingProductionRecord {
  return {
    id: String(row.id),
    batchRecordId: toNullableText(row.batch_record_id),
    mashDate: String(row.mash_date),
    gallonsMolasses: toFiniteNumber(row.gallons_molasses),
    lbsSugar: toFiniteNumber(row.lbs_sugar),
    yeastDate: toNullableText(row.yeast_date),
    libertaliaYeastPackets: toInt(row.libertalia_yeast_packets),
    riskeyYeastPackets: toInt(row.riskey_yeast_packets),
    distillDate: String(row.distill_date),
    gallonsDistilled: toFiniteNumber(row.gallons_distilled),
    percentageDistilled: toFiniteNumber(row.percentage_distilled),
    proofOfGallons: toFiniteNumber(row.proof_of_gallons),
    notes: toNullableText(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDistillingInventoryRecord(row: Record<string, unknown>): DistillingInventoryRecord {
  return {
    id: String(row.id),
    title: toNullableText(row.title),
    productName: toNullableText(row.product_name) || toNullableText(row.product_type),
    averageAbvPercent: row.average_abv_percent === null ? null : toFiniteNumber(row.average_abv_percent),
    batchRecordId: toNullableText(row.batch_record_id),
    linkedBarrelId: toNullableText(row.linked_barrel_id),
    reportMonth: String(row.report_month),
    casesMade: normalizeNumericRecord(row.cases_made, ZERO_DISTILLING_CASES_MADE),
    casesToDistributors: normalizeNumericRecord(row.cases_to_distributors, ZERO_DISTILLING_CASES_TO_DISTRIBUTORS),
    casesToRetail: normalizeNumericRecord(row.cases_to_retail, ZERO_DISTILLING_CASES_TO_RETAIL),
    bottlesMade: normalizeNumericRecord(row.bottles_made, ZERO_DISTILLING_BOTTLES_MADE),
    beginningOfMonthCases: toInt(row.beginning_of_month_cases),
    currentMonthInventory: toInt(row.current_month_inventory),
    endingMonthInventory: toInt(row.ending_month_inventory),
    endingUsGallons: toFiniteNumber(row.ending_us_gallons),
    endingProofGallons: toFiniteNumber(row.ending_proof_gallons),
    notes: toNullableText(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapPlatformConfig(row: Record<string, unknown>): PlatformConfig {
  return {
    organizationName: String(row.organization_name),
    organizationNameOverride: row.organization_name_override != null ? String(row.organization_name_override) : null,
    platformTagline: String(row.platform_tagline),
    industry: String(row.industry),
    supportEmail: String(row.support_email),
    supportPhone: String(row.support_phone),
    website: String(row.website),
    primaryAddress: String(row.primary_address),
    timeZone: String(row.time_zone),
    dspNumber: row.dsp_number != null ? String(row.dsp_number) : null,
    logoDataUrl: row.logo_data_url != null ? String(row.logo_data_url) : null,
    accountTypes: toStringArray(row.account_types),
    accountStatuses: toStringArray(row.account_statuses),
    accountIndustries: toStringArray(row.account_industries),
    accountTiers: toStringArray(row.account_tiers),
    serviceCategories: toStringArray(row.service_categories),
    serviceCatalog: toStringArray(row.service_catalog),
    locationTypes: toStringArray(row.location_types),
    locationStatuses: toStringArray(row.location_statuses),
    requirementTypes: toStringArray(row.requirement_types),
    requirementStatuses: toStringArray(row.requirement_statuses),
    requirementSeverities: toStringArray(row.requirement_severities),
  };
}

function mapAttachment(row: Record<string, unknown>): Attachment {
  return {
    id: String(row.id),
    originalFilename: String(row.original_filename),
    filePath: String(row.file_path),
    mimeType: String(row.mime_type),
    byteSize: Number(row.byte_size),
    sha256: toNullableText(row.sha256),
    docType: String(row.doc_type) as Attachment["docType"],
    effectiveOn: toNullableText(row.effective_on),
    expiresOn: toNullableText(row.expires_on),
    status: String(row.status) as Attachment["status"],
    uploadedBy: String(row.uploaded_by),
    uploadedAt: String(row.uploaded_at),
    notes: toNullableText(row.notes),
  };
}

export interface IStorage {
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  getJobsByAssignedUserId(userId: string): Promise<Job[]>;
  getJobsByCrewMemberName(name: string): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: string): Promise<void>;

  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  getProperties(): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;

  getStaff(): Promise<Staff[]>;
  getStaffMember(id: string): Promise<Staff | undefined>;
  getStaffByUserId(userId: string): Promise<Staff | undefined>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, staff: Partial<InsertStaff>): Promise<Staff>;
  deleteStaff(id: string): Promise<void>;

  getCompliance(): Promise<Compliance[]>;
  getComplianceDoc(id: string): Promise<Compliance | undefined>;
  getComplianceByClient(clientId: string): Promise<Compliance[]>;
  createCompliance(compliance: InsertCompliance): Promise<Compliance>;
  updateCompliance(id: string, compliance: Partial<InsertCompliance>): Promise<Compliance>;
  deleteCompliance(id: string): Promise<void>;

  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: string): Promise<void>;

  getInventoryLots(): Promise<InventoryLot[]>;
  getInventoryLot(id: string): Promise<InventoryLot | undefined>;
  createInventoryLot(lot: InsertInventoryLot): Promise<InventoryLot>;
  updateInventoryLot(id: string, lot: Partial<InsertInventoryLot>): Promise<InventoryLot>;
  deleteInventoryLot(id: string): Promise<void>;

  getInventoryMovements(): Promise<InventoryMovement[]>;
  createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement>;

  getBarrels(): Promise<Barrel[]>;
  getBarrel(id: string): Promise<Barrel | undefined>;
  createBarrel(barrel: InsertBarrel): Promise<Barrel>;
  updateBarrel(id: string, barrel: Partial<InsertBarrel>): Promise<Barrel>;
  deleteBarrel(id: string): Promise<void>;

  getBarrelEvents(barrelId: string): Promise<BarrelEvent[]>;
  createBarrelEvent(event: InsertBarrelEvent): Promise<BarrelEvent>;

  getTtbReports(): Promise<TtbReport[]>;
  getTtbReport(id: string): Promise<TtbReport | undefined>;
  createTtbReport(report: InsertTtbReport): Promise<TtbReport>;
  updateTtbReport(id: string, report: Partial<InsertTtbReport>): Promise<TtbReport>;
  deleteTtbReport(id: string): Promise<void>;

  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: string, limit?: number): Promise<AuditLog[]>;
  createAuditLog(entry: InsertAuditLog): Promise<AuditLog>;

  getSalesOrders(): Promise<SalesOrder[]>;
  getSalesOrder(id: string): Promise<SalesOrder | undefined>;
  createSalesOrder(order: InsertSalesOrder): Promise<SalesOrder>;
  updateSalesOrder(id: string, order: Partial<InsertSalesOrder>): Promise<SalesOrder>;
  deleteSalesOrder(id: string): Promise<void>;

  getDistillingBatchRecords(): Promise<DistillingBatchRecord[]>;
  getDistillingBatchRecord(id: string): Promise<DistillingBatchRecord | undefined>;
  createDistillingBatchRecord(record: InsertDistillingBatchRecord): Promise<DistillingBatchRecord>;
  updateDistillingBatchRecord(id: string, record: Partial<InsertDistillingBatchRecord>): Promise<DistillingBatchRecord>;
  deleteDistillingBatchRecord(id: string): Promise<void>;

  getDistillingProductionRecords(): Promise<DistillingProductionRecord[]>;
  getDistillingProductionRecord(id: string): Promise<DistillingProductionRecord | undefined>;
  createDistillingProductionRecord(record: InsertDistillingProductionRecord): Promise<DistillingProductionRecord>;
  updateDistillingProductionRecord(
    id: string,
    record: Partial<InsertDistillingProductionRecord>,
  ): Promise<DistillingProductionRecord>;
  deleteDistillingProductionRecord(id: string): Promise<void>;

  getDistillingInventoryRecords(): Promise<DistillingInventoryRecord[]>;
  getDistillingInventoryRecord(id: string): Promise<DistillingInventoryRecord | undefined>;
  createDistillingInventoryRecord(record: InsertDistillingInventoryRecord): Promise<DistillingInventoryRecord>;
  updateDistillingInventoryRecord(
    id: string,
    record: Partial<InsertDistillingInventoryRecord>,
  ): Promise<DistillingInventoryRecord>;
  deleteDistillingInventoryRecord(id: string): Promise<void>;

  getDistilleryControlTowerSummary(reportMonth?: string): Promise<DistilleryControlTowerSummary>;

  getCalculatorPresets(): Promise<CalculatorPreset[]>;
  getCalculatorPreset(id: string): Promise<CalculatorPreset | undefined>;
  createCalculatorPreset(preset: InsertCalculatorPreset): Promise<CalculatorPreset>;
  updateCalculatorPreset(id: string, preset: Partial<InsertCalculatorPreset>): Promise<CalculatorPreset>;
  deleteCalculatorPreset(id: string): Promise<void>;

  getStats(): Promise<Stats>;

  getPlatformConfig(): Promise<PlatformConfig>;
  updatePlatformConfig(config: UpdatePlatformConfig): Promise<PlatformConfig>;

  getJobPhotos(jobId: string): Promise<JobPhoto[]>;
  addJobPhoto(photo: Omit<InsertJobPhoto, "filePath"> & { filePath: string }): Promise<JobPhoto>;
  deleteJobPhoto(photoId: string): Promise<void>;

  getAttachmentsForEntity(entityType: string, entityId: string): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  linkAttachment(link: InsertAttachmentLink): Promise<AttachmentLink>;
  supersedeActiveAttachmentsForEntityDocType(
    entityType: string,
    entityId: string,
    docType: string,
    excludeAttachmentId: string,
  ): Promise<void>;

  getEquipmentList(): Promise<any[]>;
  createEquipment(data: any): Promise<any>;
  updateEquipment(id: string, data: any): Promise<any>;
  deleteEquipment(id: string): Promise<void>;
}

export class PostgresStorage implements IStorage {
  async getJobs(): Promise<Job[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM jobs WHERE tenant_id = $1 ORDER BY scheduled_date DESC, start_time ASC", [tenantId]);
    return rows.map(mapJob);
  }

  async getJob(id: string): Promise<Job | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM jobs WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapJob(rows[0]) : undefined;
  }

  async getJobsByAssignedUserId(userId: string): Promise<Job[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM jobs WHERE assigned_user_id = $1 AND tenant_id = $2", [userId, tenantId]);
    return rows.map(mapJob);
  }

  async getJobsByCrewMemberName(name: string): Promise<Job[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM jobs WHERE EXISTS (SELECT 1 FROM unnest(crew) c WHERE lower(c) = lower($1)) AND tenant_id = $2", [name, tenantId]);
    return rows.map(mapJob);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const nowDate = new Date().toISOString().slice(0, 10);
    const id = insertJob.id || generateId("BATCH");
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO jobs (
        id, tenant_id, property_id, address, service, service_category, status, start_time, end_time,
        crew, priority, block_reason, scheduled_date, assigned_user_id, work_order_number,
        estimated_minutes, completion_notes, after_photos
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
      ) RETURNING *`,
      [
        id,
        tenantId,
        insertJob.propertyId || "",
        insertJob.address || "",
        insertJob.service || "",
        insertJob.serviceCategory || null,
        insertJob.status || "Scheduled",
        insertJob.startTime || "",
        insertJob.endTime || "",
        insertJob.crew || [],
        insertJob.priority || "Normal",
        insertJob.blockReason || null,
        insertJob.scheduledDate || nowDate,
        insertJob.assignedUserId || null,
        insertJob.workOrderNumber || null,
        insertJob.estimatedMinutes ?? null,
        insertJob.completionNotes || null,
        insertJob.afterPhotos || [],
      ],
    );
    return mapJob(rows[0]);
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job> {
    const existing = await this.getJob(id);
    if (!existing) throw new Error("Job not found");
    const next: Job = {
      ...existing,
      ...updates,
      id,
      serviceCategory: updates.serviceCategory === undefined ? existing.serviceCategory : updates.serviceCategory,
      assignedUserId: updates.assignedUserId === undefined ? existing.assignedUserId : updates.assignedUserId,
      workOrderNumber: updates.workOrderNumber === undefined ? existing.workOrderNumber : updates.workOrderNumber,
      estimatedMinutes: updates.estimatedMinutes === undefined ? existing.estimatedMinutes : updates.estimatedMinutes,
      completionNotes: updates.completionNotes === undefined ? existing.completionNotes : updates.completionNotes,
    };

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE jobs SET
        property_id = $2,
        address = $3,
        service = $4,
        service_category = $5,
        status = $6,
        start_time = $7,
        end_time = $8,
        crew = $9,
        priority = $10,
        block_reason = $11,
        scheduled_date = $12,
        assigned_user_id = $13,
        work_order_number = $14,
        estimated_minutes = $15,
        completion_notes = $16,
        after_photos = $17
      WHERE id = $1 AND tenant_id = $18
      RETURNING *`,
      [
        id,
        next.propertyId,
        next.address,
        next.service,
        next.serviceCategory || null,
        next.status,
        next.startTime,
        next.endTime,
        next.crew,
        next.priority,
        next.blockReason || null,
        next.scheduledDate,
        next.assignedUserId || null,
        next.workOrderNumber || null,
        next.estimatedMinutes ?? null,
        next.completionNotes || null,
        next.afterPhotos || [],
        tenantId,
      ],
    );

    return mapJob(rows[0]);
  }

  async deleteJob(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM jobs WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getClients(): Promise<Client[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM clients WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
    return rows.map(mapClient);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM clients WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapClient(rows[0]) : undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO clients (
        id, tenant_id, name, legal_name, dba, type, contact, contact_title, contact_email, contact_phone,
        account_owner, status, website, support_email, support_phone, billing_address,
        headquarters_address, payment_terms, tax_id, industry_segment, account_tier,
        onboarding_status, renewal_date, notes, coi_expires_on, service_agreement_expires_on
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      ) RETURNING *`,
      [
        client.id || generateId("PARTNER"),
        tenantId,
        client.name || "",
        client.legalName || null,
        client.dba || null,
        client.type || "",
        client.contact || "",
        client.contactTitle || null,
        client.contactEmail || null,
        client.contactPhone || null,
        client.accountOwner || null,
        client.status || "Active",
        client.website || null,
        client.supportEmail || null,
        client.supportPhone || null,
        client.billingAddress || null,
        client.headquartersAddress || null,
        client.paymentTerms || null,
        client.taxId || null,
        client.industrySegment || null,
        client.accountTier || null,
        client.onboardingStatus || null,
        client.renewalDate || null,
        client.notes || null,
        client.coiExpiresOn || null,
        client.serviceAgreementExpiresOn || null,
      ],
    );
    return mapClient(rows[0]);
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client> {
    const existing = await this.getClient(id);
    if (!existing) throw new Error("Client not found");
    const next = { ...existing, ...updates };

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE clients SET
        name = $2,
        legal_name = $3,
        dba = $4,
        type = $5,
        contact = $6,
        contact_title = $7,
        contact_email = $8,
        contact_phone = $9,
        account_owner = $10,
        status = $11,
        website = $12,
        support_email = $13,
        support_phone = $14,
        billing_address = $15,
        headquarters_address = $16,
        payment_terms = $17,
        tax_id = $18,
        industry_segment = $19,
        account_tier = $20,
        onboarding_status = $21,
        renewal_date = $22,
        notes = $23,
        coi_expires_on = $24,
        service_agreement_expires_on = $25
      WHERE id = $1 AND tenant_id = $26
      RETURNING *`,
      [
        id,
        next.name,
        next.legalName || null,
        next.dba || null,
        next.type,
        next.contact,
        next.contactTitle || null,
        next.contactEmail || null,
        next.contactPhone || null,
        next.accountOwner || null,
        next.status,
        next.website || null,
        next.supportEmail || null,
        next.supportPhone || null,
        next.billingAddress || null,
        next.headquartersAddress || null,
        next.paymentTerms || null,
        next.taxId || null,
        next.industrySegment || null,
        next.accountTier || null,
        next.onboardingStatus || null,
        next.renewalDate || null,
        next.notes || null,
        next.coiExpiresOn || null,
        next.serviceAgreementExpiresOn || null,
        tenantId,
      ],
    );

    return mapClient(rows[0]);
  }

  async deleteClient(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM clients WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getProperties(): Promise<Property[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM properties WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
    return rows.map(mapProperty);
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM properties WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapProperty(rows[0]) : undefined;
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO properties (
        id, tenant_id, name, address, client_id, type, status, region, site_contact, site_contact_phone, access_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        property.id || generateId("FAC"),
        tenantId,
        property.name || "",
        property.address || "",
        property.clientId || "",
        property.type || null,
        property.status || null,
        property.region || null,
        property.siteContact || null,
        property.siteContactPhone || null,
        property.accessNotes || null,
      ],
    );
    return mapProperty(rows[0]);
  }

  async updateProperty(id: string, updates: Partial<InsertProperty>): Promise<Property> {
    const existing = await this.getProperty(id);
    if (!existing) throw new Error("Property not found");
    const next = { ...existing, ...updates };

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE properties SET
        name = $2,
        address = $3,
        client_id = $4,
        type = $5,
        status = $6,
        region = $7,
        site_contact = $8,
        site_contact_phone = $9,
        access_notes = $10
      WHERE id = $1 AND tenant_id = $11
      RETURNING *`,
      [
        id,
        next.name,
        next.address,
        next.clientId,
        next.type || null,
        next.status || null,
        next.region || null,
        next.siteContact || null,
        next.siteContactPhone || null,
        next.accessNotes || null,
        tenantId,
      ],
    );

    return mapProperty(rows[0]);
  }

  async deleteProperty(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM properties WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getStaff(): Promise<Staff[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM staff WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
    return rows.map(mapStaff);
  }

  async getStaffMember(id: string): Promise<Staff | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM staff WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapStaff(rows[0]) : undefined;
  }

  async getStaffByUserId(userId: string): Promise<Staff | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM staff WHERE user_id = $1 AND tenant_id = $2 LIMIT 1", [userId, tenantId]);
    return rows[0] ? mapStaff(rows[0]) : undefined;
  }

  async createStaff(staff: InsertStaff): Promise<Staff> {
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO staff (id, tenant_id, name, role, status, phone, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [staff.id || generateId("TEAM"), tenantId, staff.name || "", staff.role || "", staff.status || "Active", staff.phone || "", staff.userId || null],
    );
    return mapStaff(rows[0]);
  }

  async updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff> {
    const existing = await this.getStaffMember(id);
    if (!existing) throw new Error("Staff member not found");
    const next = { ...existing, ...updates };

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE staff SET name = $2, role = $3, status = $4, phone = $5, user_id = $6 WHERE id = $1 AND tenant_id = $7 RETURNING *`,
      [id, next.name, next.role, next.status, next.phone, next.userId || null, tenantId],
    );

    return mapStaff(rows[0]);
  }

  async deleteStaff(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM staff WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getCompliance(): Promise<Compliance[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM compliance WHERE tenant_id = $1 ORDER BY type ASC", [tenantId]);
    return rows.map(mapCompliance);
  }

  async getComplianceDoc(id: string): Promise<Compliance | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM compliance WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapCompliance(rows[0]) : undefined;
  }

  async getComplianceByClient(clientId: string): Promise<Compliance[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM compliance WHERE client_id = $1 AND tenant_id = $2 ORDER BY type ASC", [clientId, tenantId]);
    return rows.map(mapCompliance);
  }

  async createCompliance(compliance: InsertCompliance): Promise<Compliance> {
    const now = new Date().toISOString();
    const retentionYears = compliance.retentionYears ?? MIN_RECORD_RETENTION_YEARS;
    const retentionUntil = compliance.retentionUntil || addYearsIso(compliance.lastReviewedOn || now, retentionYears);
    const regulatoryArea = compliance.regulatoryArea || deriveComplianceAreaFromType(compliance.type);
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO compliance (
        id, tenant_id, client_id, type, regulatory_area, jurisdiction, control_reference, status, expires, document_url,
        owner, severity, required_for, last_reviewed_on, retention_years, retention_until, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        compliance.id || generateId("COMP"),
        tenantId,
        compliance.clientId || "",
        compliance.type || "",
        regulatoryArea,
        compliance.jurisdiction || "Federal",
        compliance.controlReference || null,
        compliance.status || "Pending Review",
        compliance.expires || null,
        compliance.documentUrl || null,
        compliance.owner || null,
        compliance.severity || null,
        compliance.requiredFor || null,
        compliance.lastReviewedOn || null,
        retentionYears,
        retentionUntil,
        compliance.createdAt || now,
        compliance.updatedAt || now,
      ],
    );

    return mapCompliance(rows[0]);
  }

  async updateCompliance(id: string, updates: Partial<InsertCompliance>): Promise<Compliance> {
    const existing = await this.getComplianceDoc(id);
    if (!existing) throw new Error("Compliance document not found");
    const now = new Date().toISOString();
    const merged = { ...existing, ...updates };
    const retentionYears = merged.retentionYears ?? existing.retentionYears ?? MIN_RECORD_RETENTION_YEARS;
    const regulatoryArea = merged.regulatoryArea || deriveComplianceAreaFromType(merged.type, "TTB Reporting");
    const retentionUntil =
      merged.retentionUntil ||
      existing.retentionUntil ||
      addYearsIso(merged.lastReviewedOn || merged.createdAt || now, retentionYears);

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE compliance SET
        client_id = $2,
        type = $3,
        regulatory_area = $4,
        jurisdiction = $5,
        control_reference = $6,
        status = $7,
        expires = $8,
        document_url = $9,
        owner = $10,
        severity = $11,
        required_for = $12,
        last_reviewed_on = $13,
        retention_years = $14,
        retention_until = $15,
        created_at = $16,
        updated_at = $17
      WHERE id = $1 AND tenant_id = $18
      RETURNING *`,
      [
        id,
        merged.clientId,
        merged.type,
        regulatoryArea,
        merged.jurisdiction || "Federal",
        merged.controlReference || null,
        merged.status,
        merged.expires || null,
        merged.documentUrl || null,
        merged.owner || null,
        merged.severity || null,
        merged.requiredFor || null,
        merged.lastReviewedOn || null,
        retentionYears,
        retentionUntil,
        merged.createdAt || existing.createdAt || now,
        now,
        tenantId,
      ],
    );

    return mapCompliance(rows[0]);
  }

  async deleteCompliance(id: string): Promise<void> {
    const existing = await this.getComplianceDoc(id);
    if (!existing) return;
    if (isRetentionLocked(existing.retentionUntil)) {
      throw new Error(
        `Record retention policy prevents deletion until ${existing.retentionUntil || "retention date is configured"}`,
      );
    }
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM compliance WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM inventory_items WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
    return rows.map(mapInventoryItem);
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM inventory_items WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapInventoryItem(rows[0]) : undefined;
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const now = new Date().toISOString();
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO inventory_items (id, tenant_id, name, category, unit_of_measure, status, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        item.id || generateId("INV"),
        tenantId,
        item.name || "",
        item.category || "",
        item.unitOfMeasure || "",
        item.status || "Active",
        item.notes || null,
        item.createdAt || now,
        item.updatedAt || now,
      ],
    );
    return mapInventoryItem(rows[0]);
  }

  async updateInventoryItem(id: string, updates: Partial<InsertInventoryItem>): Promise<InventoryItem> {
    const existing = await this.getInventoryItem(id);
    if (!existing) throw new Error("Inventory item not found");

    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE inventory_items SET
        name = $2,
        category = $3,
        unit_of_measure = $4,
        status = $5,
        notes = $6,
        updated_at = $7
      WHERE id = $1 AND tenant_id = $8
      RETURNING *`,
      [id, next.name, next.category, next.unitOfMeasure, next.status, next.notes || null, next.updatedAt, tenantId],
    );

    return mapInventoryItem(rows[0]);
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM inventory_items WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getInventoryLots(): Promise<InventoryLot[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM inventory_lots WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
    return rows.map(mapInventoryLot);
  }

  async getInventoryLot(id: string): Promise<InventoryLot | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM inventory_lots WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapInventoryLot(rows[0]) : undefined;
  }

  async createInventoryLot(lot: InsertInventoryLot): Promise<InventoryLot> {
    const now = new Date().toISOString();
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO inventory_lots (
        id, tenant_id, item_id, batch_id, lot_code, quantity, unit_of_measure, abv, proof_gallons,
        location_id, received_at, expires_at, notes, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        lot.id || generateId("LOT"),
        tenantId,
        lot.itemId || "",
        lot.batchId || null,
        lot.lotCode || "",
        lot.quantity ?? 0,
        lot.unitOfMeasure || "",
        lot.abv ?? null,
        lot.proofGallons ?? null,
        lot.locationId || null,
        lot.receivedAt || null,
        lot.expiresAt || null,
        lot.notes || null,
        lot.createdAt || now,
        lot.updatedAt || now,
      ],
    );
    return mapInventoryLot(rows[0]);
  }

  async updateInventoryLot(id: string, updates: Partial<InsertInventoryLot>): Promise<InventoryLot> {
    const existing = await this.getInventoryLot(id);
    if (!existing) throw new Error("Inventory lot not found");

    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE inventory_lots SET
        item_id = $2,
        batch_id = $3,
        lot_code = $4,
        quantity = $5,
        unit_of_measure = $6,
        abv = $7,
        proof_gallons = $8,
        location_id = $9,
        received_at = $10,
        expires_at = $11,
        notes = $12,
        updated_at = $13
      WHERE id = $1 AND tenant_id = $14
      RETURNING *`,
      [
        id,
        next.itemId,
        next.batchId || null,
        next.lotCode,
        next.quantity,
        next.unitOfMeasure,
        next.abv ?? null,
        next.proofGallons ?? null,
        next.locationId || null,
        next.receivedAt || null,
        next.expiresAt || null,
        next.notes || null,
        next.updatedAt,
        tenantId,
      ],
    );

    return mapInventoryLot(rows[0]);
  }

  async deleteInventoryLot(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM inventory_lots WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getInventoryMovements(): Promise<InventoryMovement[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM inventory_movements WHERE tenant_id = $1 ORDER BY performed_at DESC", [tenantId]);
    return rows.map(mapInventoryMovement);
  }

  async createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement> {
    const performedAt = movement.performedAt || new Date().toISOString();
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO inventory_movements (
        id, tenant_id, lot_id, movement_type, quantity, ttb_operation_category, production_stage, tax_classification,
        from_location_id, to_location_id, reason, performed_by, performed_at, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        movement.id || generateId("MOVE"),
        tenantId,
        movement.lotId || "",
        movement.movementType || "Adjust",
        movement.quantity ?? 0,
        movement.ttbOperationCategory || null,
        movement.productionStage || null,
        movement.taxClassification || null,
        movement.fromLocationId || null,
        movement.toLocationId || null,
        movement.reason || null,
        movement.performedBy || null,
        performedAt,
        movement.metadata || {},
      ],
    );

    return mapInventoryMovement(rows[0]);
  }

  async getBarrels(): Promise<Barrel[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM barrels WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
    return rows.map(mapBarrel);
  }

  async getBarrel(id: string): Promise<Barrel | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM barrels WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapBarrel(rows[0]) : undefined;
  }

  async createBarrel(barrel: InsertBarrel): Promise<Barrel> {
    const now = new Date().toISOString();
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO barrels (
        id, tenant_id, serial_number, product_name, fill_date, fill_proof, fill_proof_gallons, fill_volume, current_volume,
        current_proof_gallons, total_aging_days, dump_date, cases_made, percent_bottled, losses_proof_gallons,
        status, location_id, warehouse_zone, char_level, origin_batch_id, color_notes, nose_notes,
        sample_percent_notes, outdoor_temp, notes, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
      RETURNING *`,
      [
        barrel.id || generateId("BARREL"),
        tenantId,
        barrel.serialNumber || "",
        barrel.productName || null,
        barrel.fillDate || null,
        barrel.fillProof ?? null,
        barrel.fillProofGallons ?? null,
        barrel.fillVolume ?? null,
        barrel.currentVolume ?? null,
        barrel.currentProofGallons ?? null,
        barrel.totalAgingDays ?? null,
        barrel.dumpDate || null,
        barrel.casesMade ?? null,
        barrel.percentBottled ?? null,
        barrel.lossesProofGallons ?? null,
        barrel.status || "Filled",
        barrel.locationId || null,
        barrel.warehouseZone || null,
        barrel.charLevel || null,
        barrel.originBatchId || null,
        barrel.colorNotes || null,
        barrel.noseNotes || null,
        barrel.samplePercentNotes || null,
        barrel.outdoorTemp || null,
        barrel.notes || null,
        barrel.createdAt || now,
        barrel.updatedAt || now,
      ],
    );

    return mapBarrel(rows[0]);
  }

  async updateBarrel(id: string, updates: Partial<InsertBarrel>): Promise<Barrel> {
    const existing = await this.getBarrel(id);
    if (!existing) throw new Error("Barrel not found");

    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE barrels SET
        serial_number = $2,
        product_name = $3,
        fill_date = $4,
        fill_proof = $5,
        fill_proof_gallons = $6,
        fill_volume = $7,
        current_volume = $8,
        current_proof_gallons = $9,
        total_aging_days = $10,
        dump_date = $11,
        cases_made = $12,
        percent_bottled = $13,
        losses_proof_gallons = $14,
        status = $15,
        location_id = $16,
        warehouse_zone = $17,
        char_level = $18,
        origin_batch_id = $19,
        color_notes = $20,
        nose_notes = $21,
        sample_percent_notes = $22,
        outdoor_temp = $23,
        notes = $24,
        updated_at = $25
      WHERE id = $1 AND tenant_id = $26
      RETURNING *`,
      [
        id,
        next.serialNumber,
        next.productName || null,
        next.fillDate || null,
        next.fillProof ?? null,
        next.fillProofGallons ?? null,
        next.fillVolume ?? null,
        next.currentVolume ?? null,
        next.currentProofGallons ?? null,
        next.totalAgingDays ?? null,
        next.dumpDate || null,
        next.casesMade ?? null,
        next.percentBottled ?? null,
        next.lossesProofGallons ?? null,
        next.status,
        next.locationId || null,
        next.warehouseZone || null,
        next.charLevel || null,
        next.originBatchId || null,
        next.colorNotes || null,
        next.noseNotes || null,
        next.samplePercentNotes || null,
        next.outdoorTemp || null,
        next.notes || null,
        next.updatedAt,
        tenantId,
      ],
    );

    return mapBarrel(rows[0]);
  }

  async deleteBarrel(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM barrels WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getBarrelEvents(barrelId: string): Promise<BarrelEvent[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM barrel_events WHERE barrel_id = $1 AND tenant_id = $2 ORDER BY event_at DESC", [barrelId, tenantId]);
    return rows.map(mapBarrelEvent);
  }

  async createBarrelEvent(event: InsertBarrelEvent & { outdoorTemp?: number | null; wineGallons?: number | null }): Promise<BarrelEvent> {
    const eventAt = event.eventAt || new Date().toISOString();
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO barrel_events (
        id, tenant_id, barrel_id, event_type, event_at, volume_change, proof_at_event, outdoor_temp, wine_gallons,
        ttb_operation_category, production_stage, tax_classification, from_location_id, to_location_id,
        notes, performed_by, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        event.id || generateId("BEVT"),
        tenantId,
        event.barrelId || "",
        event.eventType || "Transfer",
        eventAt,
        event.volumeChange ?? null,
        event.proofAtEvent ?? null,
        event.outdoorTemp ?? null,
        event.wineGallons ?? null,
        event.ttbOperationCategory || null,
        event.productionStage || null,
        event.taxClassification || null,
        event.fromLocationId || null,
        event.toLocationId || null,
        event.notes || null,
        event.performedBy || null,
        event.metadata || {},
      ],
    );

    return mapBarrelEvent(rows[0]);
  }

  async getTtbReports(): Promise<TtbReport[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM ttb_reports WHERE tenant_id = $1 ORDER BY report_period_start DESC", [tenantId]);
    return rows.map(mapTtbReport);
  }

  async getTtbReport(id: string): Promise<TtbReport | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM ttb_reports WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapTtbReport(rows[0]) : undefined;
  }

  async createTtbReport(report: InsertTtbReport): Promise<TtbReport> {
    const now = new Date().toISOString();
    const cadence = report.filingCadence || deriveCadenceFromPeriod(report.reportPeriodStart || "", report.reportPeriodEnd || "");
    const dueDate =
      report.dueDate ||
      defaultDueDateForCadence(report.reportPeriodEnd || new Date().toISOString().slice(0, 10), cadence);
    const retentionUntil = report.retentionUntil || addYearsIso(now, MIN_RECORD_RETENTION_YEARS);
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO ttb_reports (
        id, tenant_id, report_period_start, report_period_end, filing_type, filing_cadence, due_date, excise_tax_due,
        status, generated_at, approved_at, approved_by, exported_at, retention_until, payload, json_path, csv_path, pdf_path
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        report.id || generateId("TTP"),
        tenantId,
        report.reportPeriodStart || "",
        report.reportPeriodEnd || "",
        report.filingType || "Storage Operations",
        cadence,
        dueDate,
        report.exciseTaxDue ?? null,
        report.status || "Draft",
        report.generatedAt || now,
        report.approvedAt || null,
        report.approvedBy || null,
        report.exportedAt || null,
        retentionUntil,
        report.payload || {},
        report.jsonPath || null,
        report.csvPath || null,
        report.pdfPath || null,
      ],
    );

    return mapTtbReport(rows[0]);
  }

  async updateTtbReport(id: string, updates: Partial<InsertTtbReport>): Promise<TtbReport> {
    const existing = await this.getTtbReport(id);
    if (!existing) throw new Error("TTB report not found");

    const next = { ...existing, ...updates };
    const cadence =
      next.filingCadence || deriveCadenceFromPeriod(next.reportPeriodStart || "", next.reportPeriodEnd || "");
    const dueDate = next.dueDate || defaultDueDateForCadence(next.reportPeriodEnd, cadence);
    const retentionUntil = next.retentionUntil || existing.retentionUntil || addYearsIso(new Date().toISOString());
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE ttb_reports SET
        report_period_start = $2,
        report_period_end = $3,
        filing_type = $4,
        filing_cadence = $5,
        due_date = $6,
        excise_tax_due = $7,
        status = $8,
        generated_at = $9,
        approved_at = $10,
        approved_by = $11,
        exported_at = $12,
        retention_until = $13,
        payload = $14,
        json_path = $15,
        csv_path = $16,
        pdf_path = $17
      WHERE id = $1 AND tenant_id = $18
      RETURNING *`,
      [
        id,
        next.reportPeriodStart,
        next.reportPeriodEnd,
        next.filingType || "Storage Operations",
        cadence,
        dueDate,
        next.exciseTaxDue ?? null,
        next.status,
        next.generatedAt || null,
        next.approvedAt || null,
        next.approvedBy || null,
        next.exportedAt || null,
        retentionUntil,
        next.payload || {},
        next.jsonPath || null,
        next.csvPath || null,
        next.pdfPath || null,
        tenantId,
      ],
    );

    return mapTtbReport(rows[0]);
  }

  async deleteTtbReport(id: string): Promise<void> {
    const existing = await this.getTtbReport(id);
    if (!existing) return;
    if (isRetentionLocked(existing.retentionUntil)) {
      throw new Error(
        `Record retention policy prevents deletion until ${existing.retentionUntil || "retention date is configured"}`,
      );
    }
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM ttb_reports WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getAuditLogs(limit = 200): Promise<AuditLog[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 2000));
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY occurred_at DESC LIMIT $2", [tenantId, boundedLimit]);
    return rows.map(mapAuditLog);
  }

  async getAuditLogsByEntity(entityType: string, entityId: string, limit = 200): Promise<AuditLog[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 2000));
    const tenantId = getCurrentTenantId();
    const rows = await query(
      "SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3 ORDER BY occurred_at DESC LIMIT $4",
      [entityType, entityId, tenantId, boundedLimit],
    );
    return rows.map(mapAuditLog);
  }

  async createAuditLog(entry: InsertAuditLog): Promise<AuditLog> {
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO audit_logs (
        id, tenant_id, entity_type, entity_id, action, actor_name, actor_role, occurred_at, details
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        entry.id || generateId("AUDIT"),
        tenantId,
        entry.entityType || "",
        entry.entityId || "",
        entry.action || "",
        entry.actorName || null,
        entry.actorRole || null,
        entry.occurredAt || new Date().toISOString(),
        entry.details || {},
      ],
    );
    return mapAuditLog(rows[0]);
  }

  async getSalesOrders(): Promise<SalesOrder[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM sales_orders WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
    return rows.map(mapSalesOrder);
  }

  async getSalesOrder(id: string): Promise<SalesOrder | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM sales_orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapSalesOrder(rows[0]) : undefined;
  }

  async createSalesOrder(order: InsertSalesOrder): Promise<SalesOrder> {
    const now = new Date().toISOString();
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO sales_orders (
        id, tenant_id, order_number, client_id, status, order_date, requested_ship_date, fulfilled_date,
        total_amount, currency, notes, line_items, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        order.id || generateId("SO"),
        tenantId,
        order.orderNumber || `SO-${Date.now()}`,
        order.clientId || "",
        order.status || "Draft",
        order.orderDate || now.slice(0, 10),
        order.requestedShipDate || null,
        order.fulfilledDate || null,
        order.totalAmount ?? null,
        order.currency || "USD",
        order.notes || null,
        JSON.stringify(order.lineItems || []),
        order.createdAt || now,
        order.updatedAt || now,
      ],
    );

    return mapSalesOrder(rows[0]);
  }

  async updateSalesOrder(id: string, updates: Partial<InsertSalesOrder>): Promise<SalesOrder> {
    const existing = await this.getSalesOrder(id);
    if (!existing) throw new Error("Sales order not found");

    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE sales_orders SET
        order_number = $2,
        client_id = $3,
        status = $4,
        order_date = $5,
        requested_ship_date = $6,
        fulfilled_date = $7,
        total_amount = $8,
        currency = $9,
        notes = $10,
        line_items = $11,
        updated_at = $12
      WHERE id = $1 AND tenant_id = $13
      RETURNING *`,
      [
        id,
        next.orderNumber,
        next.clientId,
        next.status,
        next.orderDate,
        next.requestedShipDate || null,
        next.fulfilledDate || null,
        next.totalAmount ?? null,
        next.currency,
        next.notes || null,
        JSON.stringify(next.lineItems || []),
        next.updatedAt,
        tenantId,
      ],
    );

    return mapSalesOrder(rows[0]);
  }

  async deleteSalesOrder(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM sales_orders WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  private ensureBatchDateAlignedToReportWeek(batch: DistillingBatchRecord, reportMonth: string): void {
    const reportWeek = parseWeekKey(reportMonth);
    const batchDate = parseIsoDateOnly(batch.batchDate);
    if (!reportWeek || !batchDate) return;
    if (batchDate >= reportWeek.endExclusive) {
      throw new Error(
        `Batch ${batch.batchCode} (${batch.batchDate}) occurs after report week ${reportWeek.canonical}.`,
      );
    }
  }

  private async resolveBatchForInventoryWorkflow(params: {
    batchRecordId: string;
    reportMonth: string;
    excludeInventoryRecordId?: string;
  }): Promise<DistillingBatchRecord> {
    const { batchRecordId, reportMonth, excludeInventoryRecordId } = params;
    const batch = await this.getDistillingBatchRecord(batchRecordId);
    if (!batch) {
      throw new Error("Linked batch record not found.");
    }
    if (batch.status === "Closed") {
      throw new Error(`Batch ${batch.batchCode} is closed and cannot receive inventory workflow updates.`);
    }
    if (!batch.productionRecordId) {
      throw new Error(
        `Batch ${batch.batchCode} must be linked to a production record before creating an inventory entry.`,
      );
    }
    this.ensureBatchDateAlignedToReportWeek(batch, reportMonth);

    if (batch.inventoryRecordId && batch.inventoryRecordId !== excludeInventoryRecordId) {
      throw new Error(
        `Batch ${batch.batchCode} is already linked to inventory record ${batch.inventoryRecordId}.`,
      );
    }

    const tenantId = getCurrentTenantId();
    const linkedRows = await query<{ id: string }>(
      `SELECT id
       FROM distilling_inventory_records
       WHERE batch_record_id = $1
         AND ($2::text IS NULL OR id <> $2)
         AND tenant_id = $3
       ORDER BY updated_at DESC
       LIMIT 1`,
      [batchRecordId, excludeInventoryRecordId || null, tenantId],
    );
    if (linkedRows[0]) {
      throw new Error(`Batch ${batch.batchCode} already has inventory record ${linkedRows[0].id}.`);
    }

    return batch;
  }

  private async syncBatchAfterInventoryRecord(params: {
    batch: DistillingBatchRecord;
    inventoryRecordId: string;
    soldCases: number;
  }): Promise<void> {
    const { batch, inventoryRecordId, soldCases } = params;
    const workflow = computeBatchWorkflowAfterInventory(batch, soldCases);
    const tenantId = getCurrentTenantId();
    await query(
      `UPDATE distilling_batch_records
       SET inventory_record_id = $2,
           stage = $3,
           status = $4,
           updated_at = $5
       WHERE id = $1 AND tenant_id = $6`,
      [batch.id, inventoryRecordId, workflow.stage, workflow.status, new Date().toISOString(), tenantId],
    );
  }

  private async clearBatchInventoryLink(batchRecordId: string, inventoryRecordId: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query(
      `UPDATE distilling_batch_records
       SET inventory_record_id = NULL,
           updated_at = $3
       WHERE id = $1
         AND inventory_record_id = $2
         AND tenant_id = $4`,
      [batchRecordId, inventoryRecordId, new Date().toISOString(), tenantId],
    );
  }

  private async applyInventoryBarrelAdjustment(params: {
    barrelId: string;
    deltaGallons: number;
    inventoryRecordId: string;
    reportMonth: string;
  }): Promise<void> {
    const { barrelId, deltaGallons, inventoryRecordId, reportMonth } = params;
    if (Math.abs(deltaGallons) <= 0.0001) return;

    const barrel = await this.getBarrel(barrelId);
    if (!barrel) {
      throw new Error(`Linked barrel ${barrelId} was not found.`);
    }

    const beforeCurrentVolume = Number.isFinite(barrel.currentVolume ?? NaN)
      ? (barrel.currentVolume ?? 0)
      : (Number.isFinite(barrel.fillVolume ?? NaN) ? (barrel.fillVolume ?? 0) : 0);
    const nextVolumeRaw = beforeCurrentVolume - deltaGallons;
    if (nextVolumeRaw < -0.0001) {
      throw new Error(
        `Barrel ${barrel.serialNumber} cannot cover ${roundNumber(deltaGallons, 2)} gallons. Available: ${roundNumber(beforeCurrentVolume, 2)} gallons.`,
      );
    }

    const nextCurrentVolume = roundNumber(Math.max(0, nextVolumeRaw), 2);
    const now = new Date().toISOString();
    const tenantId = getCurrentTenantId();
    await query(
      `UPDATE barrels
       SET current_volume = $2,
           updated_at = $3
       WHERE id = $1 AND tenant_id = $4`,
      [barrel.id, nextCurrentVolume, now, tenantId],
    );

    const eventType: BarrelEvent["eventType"] = deltaGallons > 0 ? "Sample" : "TopOff";
    await query(
      `INSERT INTO barrel_events (
        id, tenant_id, barrel_id, event_type, event_at, volume_change, proof_at_event, ttb_operation_category,
        production_stage, tax_classification, from_location_id, to_location_id, notes, performed_by, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        generateId("BEVT"),
        tenantId,
        barrel.id,
        eventType,
        now,
        roundNumber(Math.abs(deltaGallons), 2),
        barrel.fillProof ?? null,
        "Processing",
        "Bottling",
        "In Bond",
        null,
        null,
        `Auto-sync from inventory record ${inventoryRecordId} (${reportMonth})`,
        "System",
        {
          source: "distilling_inventory_record",
          inventoryRecordId,
          reportWeek: reportMonth,
          deltaGallons: roundNumber(deltaGallons, 2),
          beforeCurrentVolume: roundNumber(beforeCurrentVolume, 2),
          afterCurrentVolume: nextCurrentVolume,
        },
      ],
    );
  }

  private async syncInventoryBarrelFromRecordChange(params: {
    existingRecord: DistillingInventoryRecord | null;
    nextLinkedBarrelId: string | null;
    nextCasesMade: DistillingCasesMade;
    inventoryRecordId: string;
    reportMonth: string;
  }): Promise<void> {
    const { existingRecord, nextLinkedBarrelId, nextCasesMade, inventoryRecordId, reportMonth } = params;
    const previousLinkedBarrelId = toNullableText(existingRecord?.linkedBarrelId);
    const previousDrawGallons = existingRecord ? computeInventoryCasesDrawGallons(existingRecord.casesMade) : 0;
    const nextDrawGallons = computeInventoryCasesDrawGallons(nextCasesMade);

    if (previousLinkedBarrelId && previousLinkedBarrelId === nextLinkedBarrelId) {
      await this.applyInventoryBarrelAdjustment({
        barrelId: previousLinkedBarrelId,
        deltaGallons: nextDrawGallons - previousDrawGallons,
        inventoryRecordId,
        reportMonth,
      });
      return;
    }

    if (previousLinkedBarrelId) {
      await this.applyInventoryBarrelAdjustment({
        barrelId: previousLinkedBarrelId,
        deltaGallons: -previousDrawGallons,
        inventoryRecordId,
        reportMonth,
      });
    }

    if (nextLinkedBarrelId) {
      await this.applyInventoryBarrelAdjustment({
        barrelId: nextLinkedBarrelId,
        deltaGallons: nextDrawGallons,
        inventoryRecordId,
        reportMonth,
      });
    }
  }

  private async getPriorMonthEndingInventoryCases(reportMonth: string, excludeId?: string): Promise<number> {
    const periodPattern = parseWeekKey(reportMonth)
      ? "^[0-9]{4}-W[0-9]{2}$"
      : "^[0-9]{4}-[0-9]{2}$";
    const tenantId = getCurrentTenantId();

    if (!excludeId) {
      const rows = await query<{ ending_month_inventory: number }>(
        `SELECT ending_month_inventory
         FROM distilling_inventory_records
         WHERE report_month < $1
           AND report_month ~ '${periodPattern}'
           AND tenant_id = $2
         ORDER BY report_month DESC, updated_at DESC
         LIMIT 1`,
        [reportMonth, tenantId],
      );
      return rows[0] ? Math.max(0, toInt(rows[0].ending_month_inventory, 0)) : 0;
    }

    const rows = await query<{ ending_month_inventory: number }>(
      `SELECT ending_month_inventory
       FROM distilling_inventory_records
       WHERE report_month < $1
         AND report_month ~ '${periodPattern}'
         AND id <> $2
         AND tenant_id = $3
       ORDER BY report_month DESC, updated_at DESC
       LIMIT 1`,
      [reportMonth, excludeId, tenantId],
    );
    return rows[0] ? Math.max(0, toInt(rows[0].ending_month_inventory, 0)) : 0;
  }

  async getDistillingBatchRecords(): Promise<DistillingBatchRecord[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM distilling_batch_records WHERE tenant_id = $1 ORDER BY batch_date DESC, created_at DESC", [tenantId]);
    return rows.map(mapDistillingBatchRecord);
  }

  async getDistillingBatchRecord(id: string): Promise<DistillingBatchRecord | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM distilling_batch_records WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapDistillingBatchRecord(rows[0]) : undefined;
  }

  async createDistillingBatchRecord(record: InsertDistillingBatchRecord): Promise<DistillingBatchRecord> {
    const now = new Date().toISOString();
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO distilling_batch_records (
        id, tenant_id, batch_code, batch_date, stage, status,
        production_record_id, inventory_record_id, sales_order_id, notes,
        product_name, barrel_id, spirit_type, spirit_class,
        distillation_proof, proof_gallons_produced, still_type,
        fill_number, fill_proof, fill_wine_gallons, fill_proof_gallons, container_type,
        bottling_date, bottling_proof, wine_gallons_bottled, proof_gallons_processed,
        cases_750ml, cases_1000ml, cases_1750ml, total_cases,
        lot_number, tax_class, excise_tax_due, distill_date, fill_date,
        target_dump_date, amount_received_gallons,
        created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
        $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39
      ) RETURNING *`,
      [
        record.id || generateId("DBATCH"),
        tenantId,
        record.batchCode || `DBATCH-${Date.now()}`,
        record.batchDate || now.slice(0, 10),
        record.stage || "planning",
        record.status || "Draft",
        record.productionRecordId || null,
        record.inventoryRecordId || null,
        record.salesOrderId || null,
        record.notes || null,
        record.productName || null,
        record.barrelId || null,
        record.spiritType || null,
        record.spiritClass || null,
        record.distillationProof ?? null,
        record.proofGallonsProduced ?? null,
        record.stillType || null,
        record.fillNumber || null,
        record.fillProof ?? null,
        record.fillWineGallons ?? null,
        record.fillProofGallons ?? null,
        record.containerType || null,
        record.bottlingDate || null,
        record.bottlingProof ?? null,
        record.wineGallonsBottled ?? null,
        record.proofGallonsProcessed ?? null,
        record.cases750ml ?? null,
        record.cases1000ml ?? null,
        record.cases1750ml ?? null,
        record.totalCases ?? null,
        record.lotNumber || null,
        record.taxClass || null,
        record.exciseTaxDue ?? null,
        record.distillDate || null,
        record.fillDate || null,
        record.targetDumpDate || null,
        record.amountReceivedGallons ?? null,
        record.createdAt || now,
        record.updatedAt || now,
      ],
    );
    return mapDistillingBatchRecord(rows[0]);
  }

  async updateDistillingBatchRecord(
    id: string,
    updates: Partial<InsertDistillingBatchRecord>,
  ): Promise<DistillingBatchRecord> {
    const existing = await this.getDistillingBatchRecord(id);
    if (!existing) throw new Error("Distilling batch record not found");

    const next: DistillingBatchRecord = {
      ...existing,
      ...updates,
      id,
      productionRecordId: updates.productionRecordId === undefined ? existing.productionRecordId : updates.productionRecordId,
      inventoryRecordId: updates.inventoryRecordId === undefined ? existing.inventoryRecordId : updates.inventoryRecordId,
      salesOrderId: updates.salesOrderId === undefined ? existing.salesOrderId : updates.salesOrderId,
      notes: updates.notes === undefined ? existing.notes : updates.notes,
      updatedAt: new Date().toISOString(),
    };

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE distilling_batch_records SET
        batch_code = $2, batch_date = $3, stage = $4, status = $5,
        production_record_id = $6, inventory_record_id = $7, sales_order_id = $8, notes = $9,
        product_name = $10, barrel_id = $11, spirit_type = $12, spirit_class = $13,
        distillation_proof = $14, proof_gallons_produced = $15, still_type = $16,
        fill_number = $17, fill_proof = $18, fill_wine_gallons = $19, fill_proof_gallons = $20, container_type = $21,
        bottling_date = $22, bottling_proof = $23, wine_gallons_bottled = $24, proof_gallons_processed = $25,
        cases_750ml = $26, cases_1000ml = $27, cases_1750ml = $28, total_cases = $29,
        lot_number = $30, tax_class = $31, excise_tax_due = $32, distill_date = $33, fill_date = $34,
        target_dump_date = $35, amount_received_gallons = $36,
        updated_at = $37
      WHERE id = $1 AND tenant_id = $38
      RETURNING *`,
      [
        id,
        next.batchCode, next.batchDate, next.stage, next.status,
        next.productionRecordId ?? null, next.inventoryRecordId ?? null, next.salesOrderId ?? null, next.notes ?? null,
        next.productName ?? null, next.barrelId ?? null, next.spiritType ?? null, next.spiritClass ?? null,
        next.distillationProof ?? null, next.proofGallonsProduced ?? null, next.stillType ?? null,
        next.fillNumber ?? null, next.fillProof ?? null, next.fillWineGallons ?? null, next.fillProofGallons ?? null, next.containerType ?? null,
        next.bottlingDate ?? null, next.bottlingProof ?? null, next.wineGallonsBottled ?? null, next.proofGallonsProcessed ?? null,
        next.cases750ml ?? null, next.cases1000ml ?? null, next.cases1750ml ?? null, next.totalCases ?? null,
        next.lotNumber ?? null, next.taxClass ?? null, next.exciseTaxDue ?? null, next.distillDate ?? null, next.fillDate ?? null,
        next.targetDumpDate ?? null, next.amountReceivedGallons ?? null,
        next.updatedAt,
        tenantId,
      ],
    );

    return mapDistillingBatchRecord(rows[0]);
  }

  async deleteDistillingBatchRecord(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM distilling_batch_records WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getDistillingProductionRecords(): Promise<DistillingProductionRecord[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM distilling_production_records WHERE tenant_id = $1 ORDER BY distill_date DESC, created_at DESC", [tenantId]);
    return rows.map(mapDistillingProductionRecord);
  }

  async getDistillingProductionRecord(id: string): Promise<DistillingProductionRecord | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM distilling_production_records WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapDistillingProductionRecord(rows[0]) : undefined;
  }

  async createDistillingProductionRecord(
    record: InsertDistillingProductionRecord,
  ): Promise<DistillingProductionRecord> {
    const now = new Date().toISOString();
    const gallonsDistilled = toFiniteNumber(record.gallonsDistilled, 0);
    const percentageDistilled = toFiniteNumber(record.percentageDistilled, 0);
    const proofOfGallons = computeProofOfGallons(gallonsDistilled, percentageDistilled);
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO distilling_production_records (
        id, tenant_id, batch_record_id, mash_date, gallons_molasses, lbs_sugar, yeast_date, libertalia_yeast_packets,
        riskey_yeast_packets, distill_date, gallons_distilled, percentage_distilled, proof_of_gallons, notes, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        record.id || generateId("DPROD"),
        tenantId,
        record.batchRecordId || null,
        record.mashDate || now.slice(0, 10),
        toFiniteNumber(record.gallonsMolasses, 0),
        toFiniteNumber(record.lbsSugar, 0),
        record.yeastDate || null,
        Math.max(0, toInt(record.libertaliaYeastPackets, 0)),
        Math.max(0, toInt(record.riskeyYeastPackets, 0)),
        record.distillDate || now.slice(0, 10),
        gallonsDistilled,
        percentageDistilled,
        proofOfGallons,
        record.notes || null,
        record.createdAt || now,
        record.updatedAt || now,
      ],
    );
    return mapDistillingProductionRecord(rows[0]);
  }

  async updateDistillingProductionRecord(
    id: string,
    updates: Partial<InsertDistillingProductionRecord>,
  ): Promise<DistillingProductionRecord> {
    const existing = await this.getDistillingProductionRecord(id);
    if (!existing) throw new Error("Distilling production record not found");

    const gallonsDistilled = updates.gallonsDistilled === undefined ? existing.gallonsDistilled : toFiniteNumber(updates.gallonsDistilled);
    const percentageDistilled =
      updates.percentageDistilled === undefined ? existing.percentageDistilled : toFiniteNumber(updates.percentageDistilled);
    const next: DistillingProductionRecord = {
      ...existing,
      ...updates,
      id,
      batchRecordId: updates.batchRecordId === undefined ? existing.batchRecordId : updates.batchRecordId,
      yeastDate: updates.yeastDate === undefined ? existing.yeastDate : updates.yeastDate,
      notes: updates.notes === undefined ? existing.notes : updates.notes,
      gallonsDistilled,
      percentageDistilled,
      gallonsMolasses:
        updates.gallonsMolasses === undefined ? existing.gallonsMolasses : toFiniteNumber(updates.gallonsMolasses),
      lbsSugar: updates.lbsSugar === undefined ? existing.lbsSugar : toFiniteNumber(updates.lbsSugar),
      libertaliaYeastPackets:
        updates.libertaliaYeastPackets === undefined ? existing.libertaliaYeastPackets : Math.max(0, toInt(updates.libertaliaYeastPackets)),
      riskeyYeastPackets:
        updates.riskeyYeastPackets === undefined ? existing.riskeyYeastPackets : Math.max(0, toInt(updates.riskeyYeastPackets)),
      proofOfGallons: computeProofOfGallons(gallonsDistilled, percentageDistilled),
      updatedAt: new Date().toISOString(),
    };

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE distilling_production_records SET
        batch_record_id = $2,
        mash_date = $3,
        gallons_molasses = $4,
        lbs_sugar = $5,
        yeast_date = $6,
        libertalia_yeast_packets = $7,
        riskey_yeast_packets = $8,
        distill_date = $9,
        gallons_distilled = $10,
        percentage_distilled = $11,
        proof_of_gallons = $12,
        notes = $13,
        updated_at = $14
      WHERE id = $1 AND tenant_id = $15
      RETURNING *`,
      [
        id,
        next.batchRecordId || null,
        next.mashDate,
        next.gallonsMolasses,
        next.lbsSugar,
        next.yeastDate || null,
        next.libertaliaYeastPackets,
        next.riskeyYeastPackets,
        next.distillDate,
        next.gallonsDistilled,
        next.percentageDistilled,
        next.proofOfGallons,
        next.notes || null,
        next.updatedAt,
        tenantId,
      ],
    );

    return mapDistillingProductionRecord(rows[0]);
  }

  async deleteDistillingProductionRecord(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM distilling_production_records WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getDistillingInventoryRecords(): Promise<DistillingInventoryRecord[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM distilling_inventory_records WHERE tenant_id = $1 ORDER BY report_month DESC, updated_at DESC", [tenantId]);
    return rows.map(mapDistillingInventoryRecord);
  }

  async getDistillingInventoryRecord(id: string): Promise<DistillingInventoryRecord | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM distilling_inventory_records WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapDistillingInventoryRecord(rows[0]) : undefined;
  }

  async createDistillingInventoryRecord(record: InsertDistillingInventoryRecord): Promise<DistillingInventoryRecord> {
    const now = new Date().toISOString();
    const reportMonth = normalizeReportMonth(record.reportMonth);
    const casesMade = normalizeNumericRecord(record.casesMade, ZERO_DISTILLING_CASES_MADE);
    const casesToDistributors = normalizeNumericRecord(
      record.casesToDistributors,
      ZERO_DISTILLING_CASES_TO_DISTRIBUTORS,
    );
    const casesToRetail = normalizeNumericRecord(record.casesToRetail, ZERO_DISTILLING_CASES_TO_RETAIL);
    const bottlesMade = normalizeNumericRecord(record.bottlesMade, ZERO_DISTILLING_BOTTLES_MADE);
    const beginningOfMonthCases =
      record.beginningOfMonthCases === undefined || record.beginningOfMonthCases === null
        ? await this.getPriorMonthEndingInventoryCases(reportMonth)
        : Math.max(0, toInt(record.beginningOfMonthCases, 0));
    const derived = computeDistillingInventoryDerived({
      beginningOfMonthCases,
      casesMade,
      casesToDistributors,
      casesToRetail,
    });
    const totalSoldCases = sumNumericRecord(casesToDistributors) + sumNumericRecord(casesToRetail);
    const normalizedTitle = toNullableText(record.title);
    const normalizedProductName = toNullableText(record.productName);
    const normalizedAverageAbvPercent =
      record.averageAbvPercent === undefined || record.averageAbvPercent === null
        ? null
        : Math.max(0, Math.min(100, toFiniteNumber(record.averageAbvPercent, 0)));
    const normalizedBatchRecordId = toNullableText(record.batchRecordId);
    const normalizedLinkedBarrelId = toNullableText(record.linkedBarrelId);

    const linkedBatch = normalizedBatchRecordId
      ? await this.resolveBatchForInventoryWorkflow({
          batchRecordId: normalizedBatchRecordId,
          reportMonth,
        })
      : null;

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO distilling_inventory_records (
        id, tenant_id, title, product_name, average_abv_percent, batch_record_id, linked_barrel_id, report_month,
        cases_made, cases_to_distributors, cases_to_retail, bottles_made,
        beginning_of_month_cases, current_month_inventory, ending_month_inventory, ending_us_gallons, ending_proof_gallons,
        notes, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        record.id || generateId("DINV"),
        tenantId,
        normalizedTitle,
        normalizedProductName,
        normalizedAverageAbvPercent,
        normalizedBatchRecordId,
        normalizedLinkedBarrelId,
        reportMonth,
        JSON.stringify(casesMade),
        JSON.stringify(casesToDistributors),
        JSON.stringify(casesToRetail),
        JSON.stringify(bottlesMade),
        beginningOfMonthCases,
        derived.currentMonthInventory,
        derived.endingMonthInventory,
        derived.endingUsGallons,
        derived.endingProofGallons,
        record.notes || null,
        record.createdAt || now,
        record.updatedAt || now,
      ],
    );
    const created = mapDistillingInventoryRecord(rows[0]);

    if (linkedBatch) {
      await this.syncBatchAfterInventoryRecord({
        batch: linkedBatch,
        inventoryRecordId: created.id,
        soldCases: totalSoldCases,
      });
    }
    await this.syncInventoryBarrelFromRecordChange({
      existingRecord: null,
      nextLinkedBarrelId: normalizedLinkedBarrelId,
      nextCasesMade: casesMade,
      inventoryRecordId: created.id,
      reportMonth,
    });

    return created;
  }

  async updateDistillingInventoryRecord(
    id: string,
    updates: Partial<InsertDistillingInventoryRecord>,
  ): Promise<DistillingInventoryRecord> {
    const existing = await this.getDistillingInventoryRecord(id);
    if (!existing) throw new Error("Distilling inventory record not found");
    const existingTitle = toNullableText(existing.title);
    const existingProductName = toNullableText(existing.productName);
    const existingAverageAbvPercent =
      existing.averageAbvPercent === undefined || existing.averageAbvPercent === null
        ? null
        : Math.max(0, Math.min(100, toFiniteNumber(existing.averageAbvPercent, 0)));
    const existingBatchRecordId = toNullableText(existing.batchRecordId);
    const existingLinkedBarrelId = toNullableText(existing.linkedBarrelId);
    const nextReportMonth =
      updates.reportMonth === undefined ? existing.reportMonth : normalizeReportMonth(updates.reportMonth);

    const casesMade =
      updates.casesMade === undefined
        ? existing.casesMade
        : normalizeNumericRecord(updates.casesMade, ZERO_DISTILLING_CASES_MADE);
    const casesToDistributors =
      updates.casesToDistributors === undefined
        ? existing.casesToDistributors
        : normalizeNumericRecord(updates.casesToDistributors, ZERO_DISTILLING_CASES_TO_DISTRIBUTORS);
    const casesToRetail =
      updates.casesToRetail === undefined
        ? existing.casesToRetail
        : normalizeNumericRecord(updates.casesToRetail, ZERO_DISTILLING_CASES_TO_RETAIL);
    const bottlesMade =
      updates.bottlesMade === undefined
        ? existing.bottlesMade
        : normalizeNumericRecord(updates.bottlesMade, ZERO_DISTILLING_BOTTLES_MADE);
    const beginningOfMonthCases =
      updates.beginningOfMonthCases === undefined
        ? (
            updates.reportMonth === undefined
              ? existing.beginningOfMonthCases
              : await this.getPriorMonthEndingInventoryCases(nextReportMonth, id)
          )
        : Math.max(0, toInt(updates.beginningOfMonthCases, 0));
    const derived = computeDistillingInventoryDerived({
      beginningOfMonthCases,
      casesMade,
      casesToDistributors,
      casesToRetail,
    });
    const totalSoldCases = sumNumericRecord(casesToDistributors) + sumNumericRecord(casesToRetail);
    const nextTitle = updates.title === undefined ? existingTitle : toNullableText(updates.title);
    const nextProductName = updates.productName === undefined ? existingProductName : toNullableText(updates.productName);
    const nextAverageAbvPercent =
      updates.averageAbvPercent === undefined
        ? existingAverageAbvPercent
        : updates.averageAbvPercent === null
          ? null
          : Math.max(0, Math.min(100, toFiniteNumber(updates.averageAbvPercent, 0)));
    const nextBatchRecordId =
      updates.batchRecordId === undefined ? existingBatchRecordId : toNullableText(updates.batchRecordId);
    const nextLinkedBarrelId =
      updates.linkedBarrelId === undefined ? existingLinkedBarrelId : toNullableText(updates.linkedBarrelId);

    const linkedBatch = nextBatchRecordId
      ? await this.resolveBatchForInventoryWorkflow({
          batchRecordId: nextBatchRecordId,
          reportMonth: nextReportMonth,
          excludeInventoryRecordId: id,
        })
      : null;

    const next: DistillingInventoryRecord = {
      ...existing,
      ...updates,
      id,
      title: nextTitle,
      productName: nextProductName,
      averageAbvPercent: nextAverageAbvPercent,
      batchRecordId: nextBatchRecordId,
      linkedBarrelId: nextLinkedBarrelId,
      reportMonth: nextReportMonth,
      casesMade,
      casesToDistributors,
      casesToRetail,
      bottlesMade,
      beginningOfMonthCases,
      currentMonthInventory: derived.currentMonthInventory,
      endingMonthInventory: derived.endingMonthInventory,
      endingUsGallons: derived.endingUsGallons,
      endingProofGallons: derived.endingProofGallons,
      notes: updates.notes === undefined ? existing.notes : updates.notes,
      updatedAt: new Date().toISOString(),
    };

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE distilling_inventory_records SET
        title = $2,
        product_name = $3,
        average_abv_percent = $4,
        batch_record_id = $5,
        linked_barrel_id = $6,
        report_month = $7,
        cases_made = $8,
        cases_to_distributors = $9,
        cases_to_retail = $10,
        bottles_made = $11,
        beginning_of_month_cases = $12,
        current_month_inventory = $13,
        ending_month_inventory = $14,
        ending_us_gallons = $15,
        ending_proof_gallons = $16,
        notes = $17,
        updated_at = $18
      WHERE id = $1 AND tenant_id = $19
      RETURNING *`,
      [
        id,
        next.title || null,
        next.productName || null,
        next.averageAbvPercent ?? null,
        next.batchRecordId || null,
        next.linkedBarrelId || null,
        next.reportMonth,
        JSON.stringify(next.casesMade),
        JSON.stringify(next.casesToDistributors),
        JSON.stringify(next.casesToRetail),
        JSON.stringify(next.bottlesMade),
        next.beginningOfMonthCases,
        next.currentMonthInventory,
        next.endingMonthInventory,
        next.endingUsGallons,
        next.endingProofGallons,
        next.notes || null,
        next.updatedAt,
        tenantId,
      ],
    );
    const updatedRecord = mapDistillingInventoryRecord(rows[0]);

    if (existingBatchRecordId && existingBatchRecordId !== nextBatchRecordId) {
      await this.clearBatchInventoryLink(existingBatchRecordId, id);
    }
    if (linkedBatch) {
      await this.syncBatchAfterInventoryRecord({
        batch: linkedBatch,
        inventoryRecordId: id,
        soldCases: totalSoldCases,
      });
    }
    await this.syncInventoryBarrelFromRecordChange({
      existingRecord: existing,
      nextLinkedBarrelId,
      nextCasesMade: casesMade,
      inventoryRecordId: id,
      reportMonth: nextReportMonth,
    });

    return updatedRecord;
  }

  async deleteDistillingInventoryRecord(id: string): Promise<void> {
    const existing = await this.getDistillingInventoryRecord(id);
    if (existing) {
      await this.syncInventoryBarrelFromRecordChange({
        existingRecord: existing,
        nextLinkedBarrelId: null,
        nextCasesMade: ZERO_DISTILLING_CASES_MADE,
        inventoryRecordId: id,
        reportMonth: existing.reportMonth,
      });
    }
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM distilling_inventory_records WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
    const batchRecordId = toNullableText(existing?.batchRecordId);
    if (batchRecordId) {
      await this.clearBatchInventoryLink(batchRecordId, id);
    }
  }

  async getDistilleryControlTowerSummary(reportMonth?: string): Promise<DistilleryControlTowerSummary> {
    // Source everything from batch records — the single source of truth
    const [allBatches, allOrders] = await Promise.all([
      this.getDistillingBatchRecords(),
      this.getSalesOrders(),
    ]);
    const batches = reportMonth
      ? allBatches.filter(b => b.batchDate.startsWith(reportMonth))
      : allBatches;
    const salesOrders = reportMonth
      ? allOrders.filter(o => o.orderDate.startsWith(reportMonth))
      : allOrders;

    // Proof gallons produced — from batches that have reached distillation+
    const proofGallonsProduced = roundNumber(
      batches.reduce((sum, b) => sum + toFiniteNumber((b as any).proofGallonsProduced), 0), 2,
    );
    // Wine gallons at distillation = fill wine gallons across all barreled batches
    const wineGallonsDistilled = roundNumber(
      batches.reduce((sum, b) => sum + toFiniteNumber((b as any).fillWineGallons), 0), 2,
    );

    // Bottling totals — only batches that have bottling data
    const cases750  = batches.reduce((sum, b) => sum + toFiniteNumber((b as any).cases750ml), 0);
    const cases1000 = batches.reduce((sum, b) => sum + toFiniteNumber((b as any).cases1000ml), 0);
    const cases1750 = batches.reduce((sum, b) => sum + toFiniteNumber((b as any).cases1750ml), 0);
    const totalCasesBottled = cases750 + cases1000 + cases1750;
    const totalBottles = cases750 * 6 + cases1000 * 6 + cases1750 * 6;

    // Sales orders
    const fulfilledOrders = salesOrders.filter(o => ["Approved", "Fulfilled"].includes(o.status));
    const lineItemCases = (order: typeof salesOrders[0]) =>
      (order.lineItems ?? []).reduce((s: number, li: any) => s + toFiniteNumber(li.quantity), 0);
    const distCases = fulfilledOrders.reduce((sum, o) => sum + lineItemCases(o), 0);

    return {
      asOf: new Date().toISOString(),
      reportMonth: reportMonth ?? new Date().toISOString().slice(0, 7),
      produced: {
        recordCount: batches.filter(b => ["distillation","barreling","aging","bottling","closed"].includes(b.stage)).length,
        gallonsDistilled: wineGallonsDistilled,
        proofGallons: proofGallonsProduced,
      },
      bottled: {
        inventoryRecordCount: batches.filter(b => ["bottling","closed"].includes(b.stage)).length,
        casesMade: totalCasesBottled,
        bottlesMade: totalBottles,
      },
      sold: {
        distributorCases: distCases,
        retailCases: 0,
        totalCases: distCases,
        salesOrdersApprovedOrFulfilled: fulfilledOrders.length,
      },
      inventory: {
        beginningOfMonthCases: 0,
        currentMonthInventory: totalCasesBottled,
        endingMonthInventory: totalCasesBottled,
        endingUsGallons: wineGallonsDistilled,
        endingProofGallons: proofGallonsProduced,
      },
    };
  }

  async getCalculatorPresets(): Promise<CalculatorPreset[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM calculator_presets WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
    return rows.map(mapCalculatorPreset);
  }

  async getCalculatorPreset(id: string): Promise<CalculatorPreset | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM calculator_presets WHERE id = $1 AND tenant_id = $2 LIMIT 1", [id, tenantId]);
    return rows[0] ? mapCalculatorPreset(rows[0]) : undefined;
  }

  async createCalculatorPreset(preset: InsertCalculatorPreset): Promise<CalculatorPreset> {
    const now = new Date().toISOString();
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `INSERT INTO calculator_presets (
        id, tenant_id, name, calculation_type, parameters, notes, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        preset.id || generateId("PRESET"),
        tenantId,
        preset.name || "",
        preset.calculationType || "proof_gallons",
        preset.parameters || {},
        preset.notes || null,
        preset.createdAt || now,
        preset.updatedAt || now,
      ],
    );

    return mapCalculatorPreset(rows[0]);
  }

  async updateCalculatorPreset(id: string, updates: Partial<InsertCalculatorPreset>): Promise<CalculatorPreset> {
    const existing = await this.getCalculatorPreset(id);
    if (!existing) throw new Error("Calculator preset not found");

    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE calculator_presets SET
        name = $2,
        calculation_type = $3,
        parameters = $4,
        notes = $5,
        updated_at = $6
      WHERE id = $1 AND tenant_id = $7
      RETURNING *`,
      [id, next.name, next.calculationType, next.parameters || {}, next.notes || null, next.updatedAt, tenantId],
    );

    return mapCalculatorPreset(rows[0]);
  }

  async deleteCalculatorPreset(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM calculator_presets WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  async getStats(): Promise<Stats> {
    const tenantId = getCurrentTenantId();
    const rows = await query<{ stage: string; count: number }>(
      `SELECT stage, COUNT(*)::int AS count FROM distilling_batch_records WHERE tenant_id = $1 GROUP BY stage`,
      [tenantId],
    );

    const map = new Map(rows.map((row) => [row.stage, Number(row.count)]));
    const inProgress =
      (map.get("mash_fermentation") || 0) +
      (map.get("distillation") || 0) +
      (map.get("barreling") || 0) +
      (map.get("aging") || 0) +
      (map.get("bottling") || 0);
    return {
      scheduled: map.get("planning") || 0,
      inProgress,
      completed: map.get("closed") || 0,
      blocked: 0,
    };
  }

  async getPlatformConfig(): Promise<PlatformConfig> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM platform_config WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    if (!rows[0]) {
      await this.updatePlatformConfig(defaultPlatformConfig);
      return defaultPlatformConfig;
    }
    return mapPlatformConfig(rows[0]);
  }

  async updatePlatformConfig(config: UpdatePlatformConfig): Promise<PlatformConfig> {
    const tenantId = getCurrentTenantId();
    const current = await this.getPlatformConfigSafe();
    const next: PlatformConfig = { ...current, ...config };

    await query(
      `INSERT INTO platform_config (
        tenant_id, organization_name, organization_name_override, platform_tagline, industry, support_email, support_phone,
        website, primary_address, time_zone, dsp_number, logo_data_url,
        account_types, account_statuses, account_industries,
        account_tiers, service_categories, service_catalog, location_types, location_statuses,
        requirement_types, requirement_statuses, requirement_severities
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        organization_name = EXCLUDED.organization_name,
        organization_name_override = EXCLUDED.organization_name_override,
        platform_tagline = EXCLUDED.platform_tagline,
        industry = EXCLUDED.industry,
        support_email = EXCLUDED.support_email,
        support_phone = EXCLUDED.support_phone,
        website = EXCLUDED.website,
        primary_address = EXCLUDED.primary_address,
        time_zone = EXCLUDED.time_zone,
        dsp_number = EXCLUDED.dsp_number,
        logo_data_url = EXCLUDED.logo_data_url,
        account_types = EXCLUDED.account_types,
        account_statuses = EXCLUDED.account_statuses,
        account_industries = EXCLUDED.account_industries,
        account_tiers = EXCLUDED.account_tiers,
        service_categories = EXCLUDED.service_categories,
        service_catalog = EXCLUDED.service_catalog,
        location_types = EXCLUDED.location_types,
        location_statuses = EXCLUDED.location_statuses,
        requirement_types = EXCLUDED.requirement_types,
        requirement_statuses = EXCLUDED.requirement_statuses,
        requirement_severities = EXCLUDED.requirement_severities`,
      [
        tenantId,
        next.organizationName,
        next.organizationNameOverride ?? null,
        next.platformTagline,
        next.industry,
        next.supportEmail,
        next.supportPhone,
        next.website,
        next.primaryAddress,
        next.timeZone,
        next.dspNumber ?? null,
        next.logoDataUrl ?? null,
        next.accountTypes,
        next.accountStatuses,
        next.accountIndustries,
        next.accountTiers,
        next.serviceCategories,
        next.serviceCatalog,
        next.locationTypes,
        next.locationStatuses,
        next.requirementTypes,
        next.requirementStatuses,
        next.requirementSeverities,
      ],
    );

    return next;
  }

  private async getPlatformConfigSafe(): Promise<PlatformConfig> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM platform_config WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    if (!rows[0]) return defaultPlatformConfig;
    return mapPlatformConfig(rows[0]);
  }

  async getJobPhotos(jobId: string): Promise<JobPhoto[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM job_photos WHERE job_id = $1 AND tenant_id = $2 ORDER BY uploaded_at DESC", [jobId, tenantId]);
    return rows.map((row) => ({
      id: String(row.id),
      jobId: String(row.job_id),
      filename: String(row.filename),
      filePath: String(row.file_path),
      uploadedBy: String(row.uploaded_by),
      uploadedAt: String(row.uploaded_at),
    }));
  }

  async addJobPhoto(photo: Omit<InsertJobPhoto, "filePath"> & { filePath: string }): Promise<JobPhoto> {
    const created: JobPhoto = {
      id: generateId("PHOTO"),
      jobId: photo.jobId,
      filename: photo.filename,
      filePath: photo.filePath,
      uploadedBy: photo.uploadedBy,
      uploadedAt: new Date().toISOString(),
    };

    const tenantId = getCurrentTenantId();
    await query(
      `INSERT INTO job_photos (id, tenant_id, job_id, filename, file_path, uploaded_by, uploaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [created.id, tenantId, created.jobId, created.filename, created.filePath, created.uploadedBy, created.uploadedAt],
    );

    return created;
  }

	async deleteJobPhoto(photoId: string): Promise<void> {
		const tenantId = getCurrentTenantId();
		await query("DELETE FROM job_photos WHERE id = $1 AND tenant_id = $2", [photoId, tenantId]);
	}

	async getAttachmentsForEntity(entityType: string, entityId: string): Promise<Attachment[]> {
		const tenantId = getCurrentTenantId();
		const rows = await query(
			`SELECT a.*
			 FROM attachments a
			 INNER JOIN attachment_links l ON l.attachment_id = a.id
			 WHERE l.entity_type = $1 AND l.entity_id = $2 AND a.tenant_id = $3
			 ORDER BY a.uploaded_at DESC`,
			[entityType, entityId, tenantId],
		);
		return rows.map(mapAttachment);
	}

	async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
		const created: Attachment = {
			id: generateId("ATT"),
			originalFilename: attachment.originalFilename,
			filePath: attachment.filePath,
			mimeType: attachment.mimeType,
			byteSize: attachment.byteSize,
			sha256: attachment.sha256 ?? null,
			docType: attachment.docType,
			effectiveOn: attachment.effectiveOn ?? null,
			expiresOn: attachment.expiresOn ?? null,
			status: attachment.status,
			uploadedBy: attachment.uploadedBy,
			uploadedAt: new Date().toISOString(),
			notes: attachment.notes ?? null,
		};

		const tenantId = getCurrentTenantId();
		await query(
			`INSERT INTO attachments (
			  id, tenant_id, original_filename, file_path, mime_type, byte_size, sha256,
			  doc_type, effective_on, expires_on, status, uploaded_by, uploaded_at, notes
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
			[
				created.id,
				tenantId,
				created.originalFilename,
				created.filePath,
				created.mimeType,
				created.byteSize,
				created.sha256,
				created.docType,
				created.effectiveOn,
				created.expiresOn,
				created.status,
				created.uploadedBy,
				created.uploadedAt,
				created.notes,
			],
		);

		return created;
	}

	async linkAttachment(link: InsertAttachmentLink): Promise<AttachmentLink> {
		const created: AttachmentLink = {
			id: generateId("LINK"),
			attachmentId: link.attachmentId,
			entityType: link.entityType,
			entityId: link.entityId,
			relationship: link.relationship,
			linkedBy: link.linkedBy,
			linkedAt: new Date().toISOString(),
		};

		const tenantId = getCurrentTenantId();
		await query(
			`INSERT INTO attachment_links (
			  id, tenant_id, attachment_id, entity_type, entity_id, relationship, linked_by, linked_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			[
				created.id,
				tenantId,
				created.attachmentId,
				created.entityType,
				created.entityId,
				created.relationship,
				created.linkedBy,
				created.linkedAt,
			],
		);

		return created;
	}

	async supersedeActiveAttachmentsForEntityDocType(
		entityType: string,
		entityId: string,
		docType: string,
		excludeAttachmentId: string,
	): Promise<void> {
		const tenantId = getCurrentTenantId();
		await query(
			`UPDATE attachments
			 SET status = 'superseded'
			 WHERE status = 'active'
			   AND doc_type = $3
			   AND id <> $4
			   AND tenant_id = $5
			   AND id IN (
			     SELECT attachment_id
			     FROM attachment_links
			     WHERE entity_type = $1 AND entity_id = $2
			   )`,
			[entityType, entityId, docType, excludeAttachmentId, tenantId],
		);
	}

	// Equipment
	async getEquipmentList(): Promise<any[]> {
		const tenantId = getCurrentTenantId();
		const rows = await query("SELECT * FROM distillery_equipment WHERE tenant_id = $1 ORDER BY zone, sort_order, name", [tenantId]);
		return rows.map(r => ({
			id: String((r as any).id),
			name: String((r as any).name),
			displayName: (r as any).display_name ? String((r as any).display_name) : null,
			type: String((r as any).type),
			zone: String((r as any).zone),
			capacity: (r as any).capacity != null ? Number((r as any).capacity) : null,
			capacityUnit: String((r as any).capacity_unit ?? "gallons"),
			status: String((r as any).status),
			linkedBatchId: (r as any).linked_batch_id ? String((r as any).linked_batch_id) : null,
			linkedBarrelId: (r as any).linked_barrel_id ? String((r as any).linked_barrel_id) : null,
			notes: (r as any).notes ? String((r as any).notes) : null,
			sortOrder: Number((r as any).sort_order ?? 0),
			createdAt: String((r as any).created_at),
			updatedAt: String((r as any).updated_at),
		}));
	}

	async createEquipment(data: any): Promise<any> {
		const now = new Date().toISOString();
		const id = generateId("EQ");
		const tenantId = getCurrentTenantId();
		await query(
			`INSERT INTO distillery_equipment (id, tenant_id, name, display_name, type, zone, capacity, capacity_unit, status, linked_batch_id, linked_barrel_id, notes, sort_order, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
			[id, tenantId, data.name, data.displayName||null, data.type||"tank", data.zone||"other", data.capacity??null, data.capacityUnit||"gallons", data.status||"empty", data.linkedBatchId||null, data.linkedBarrelId||null, data.notes||null, data.sortOrder??0, now, now]
		);
		return this.getEquipmentList().then(list => list.find(e => e.id === id)!);
	}

	async updateEquipment(id: string, data: any): Promise<any> {
		const now = new Date().toISOString();
		const tenantId = getCurrentTenantId();
		await query(
			`UPDATE distillery_equipment SET name=$2, display_name=$3, type=$4, zone=$5, capacity=$6, capacity_unit=$7, status=$8, linked_batch_id=$9, linked_barrel_id=$10, notes=$11, sort_order=$12, updated_at=$13 WHERE id=$1 AND tenant_id=$14`,
			[id, data.name, data.displayName||null, data.type||"tank", data.zone||"other", data.capacity??null, data.capacityUnit||"gallons", data.status||"empty", data.linkedBatchId||null, data.linkedBarrelId||null, data.notes||null, data.sortOrder??0, now, tenantId]
		);
		return this.getEquipmentList().then(list => list.find(e => e.id === id)!);
	}

	async deleteEquipment(id: string): Promise<void> {
		const tenantId = getCurrentTenantId();
		await query("DELETE FROM distillery_equipment WHERE id=$1 AND tenant_id=$2", [id, tenantId]);
	}
}

function derivePermitStatus(expirationDate: string, reminderDaysBefore: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expirationDate);
  expiry.setHours(0, 0, 0, 0);
  if (expiry < today) return "expired";
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= reminderDaysBefore) return "expiring_soon";
  return "active";
}

function mapPermit(row: Record<string, unknown>) {
  const reminderDaysBefore = Number(row.reminder_days_before ?? 90);
  const expirationDate = String(row.expiration_date ?? "");
  return {
    id: String(row.id),
    permitType: String(row.permit_type),
    permitNumber: String(row.permit_number),
    issuingAuthority: String(row.issuing_authority),
    state: row.state != null ? String(row.state) : null,
    issueDate: String(row.issue_date),
    expirationDate,
    reminderDaysBefore,
    status: derivePermitStatus(expirationDate, reminderDaysBefore),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapColaRegistration(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    productName: String(row.product_name),
    brandName: String(row.brand_name),
    classType: String(row.class_type),
    formulaNumber: row.formula_number != null ? String(row.formula_number) : null,
    colaNumber: row.cola_number != null ? String(row.cola_number) : null,
    status: String(row.status),
    appliedAt: row.applied_at != null ? String(row.applied_at) : null,
    approvedAt: row.approved_at != null ? String(row.approved_at) : null,
    expiresAt: row.expires_at != null ? String(row.expires_at) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapLabelRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    productName: String(row.product_name),
    sku: String(row.sku),
    version: String(row.version),
    colaId: row.cola_id != null ? String(row.cola_id) : null,
    netContents: row.net_contents != null ? String(row.net_contents) : null,
    alcoholContent: row.alcohol_content != null ? Number(row.alcohol_content) : null,
    classType: String(row.class_type),
    status: String(row.status),
    approvedAt: row.approved_at != null ? String(row.approved_at) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapStateExciseReturn(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    state: String(row.state),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    dueDate: String(row.due_date),
    status: String(row.status),
    totalProofGallons: Number(row.total_proof_gallons),
    ratePerProofGallon: Number(row.rate_per_proof_gallon),
    totalTax: Number(row.total_tax),
    filedAt: row.filed_at != null ? String(row.filed_at) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getPermits() {
  const tenantId = getCurrentTenantId();
  const rows = await query("SELECT * FROM permits WHERE tenant_id = $1 ORDER BY expiration_date ASC", [tenantId]);
  return rows.map(mapPermit);
}

export async function createPermit(data: Record<string, unknown>) {
  const id = generateId("PRMT");
  const now = new Date().toISOString();
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `INSERT INTO permits (id, tenant_id, permit_type, permit_number, issuing_authority, state, issue_date, expiration_date, reminder_days_before, status, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12) RETURNING *`,
    [
      id,
      tenantId,
      String(data.permitType ?? ""),
      String(data.permitNumber ?? ""),
      String(data.issuingAuthority ?? ""),
      data.state != null && String(data.state).trim() !== "" ? String(data.state) : null,
      String(data.issueDate ?? ""),
      String(data.expirationDate ?? ""),
      Number(data.reminderDaysBefore ?? 90),
      data.notes != null && String(data.notes).trim() !== "" ? String(data.notes) : null,
      now,
      now,
    ],
  );
  return mapPermit(rows[0]);
}

export async function updatePermit(id: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `UPDATE permits SET
       permit_type = COALESCE($2, permit_type),
       permit_number = COALESCE($3, permit_number),
       issuing_authority = COALESCE($4, issuing_authority),
       state = $5,
       issue_date = COALESCE($6, issue_date),
       expiration_date = COALESCE($7, expiration_date),
       reminder_days_before = COALESCE($8, reminder_days_before),
       notes = $9,
       updated_at = $10
     WHERE id = $1 AND tenant_id = $11 RETURNING *`,
    [
      id,
      data.permitType != null ? String(data.permitType) : null,
      data.permitNumber != null ? String(data.permitNumber) : null,
      data.issuingAuthority != null ? String(data.issuingAuthority) : null,
      data.state != null && String(data.state).trim() !== "" ? String(data.state) : null,
      data.issueDate != null ? String(data.issueDate) : null,
      data.expirationDate != null ? String(data.expirationDate) : null,
      data.reminderDaysBefore != null ? Number(data.reminderDaysBefore) : null,
      data.notes != null && String(data.notes).trim() !== "" ? String(data.notes) : null,
      now,
      tenantId,
    ],
  );
  if (!rows[0]) throw new Error("Permit not found");
  return mapPermit(rows[0]);
}

export async function deletePermit(id: string) {
  const tenantId = getCurrentTenantId();
  await query("DELETE FROM permits WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export async function getColaRegistrations() {
  const tenantId = getCurrentTenantId();
  const rows = await query("SELECT * FROM cola_registrations WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
  return rows.map(mapColaRegistration);
}

export async function createColaRegistration(data: Record<string, unknown>) {
  const id = generateId("COLA");
  const now = new Date().toISOString();
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `INSERT INTO cola_registrations (id, tenant_id, product_name, brand_name, class_type, formula_number, cola_number, status, applied_at, approved_at, expires_at, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      id,
      tenantId,
      String(data.productName ?? ""),
      String(data.brandName ?? ""),
      String(data.classType ?? ""),
      data.formulaNumber != null && String(data.formulaNumber).trim() !== "" ? String(data.formulaNumber) : null,
      data.colaNumber != null && String(data.colaNumber).trim() !== "" ? String(data.colaNumber) : null,
      String(data.status ?? "pending"),
      data.appliedAt != null && String(data.appliedAt).trim() !== "" ? String(data.appliedAt) : null,
      data.approvedAt != null && String(data.approvedAt).trim() !== "" ? String(data.approvedAt) : null,
      data.expiresAt != null && String(data.expiresAt).trim() !== "" ? String(data.expiresAt) : null,
      data.notes != null && String(data.notes).trim() !== "" ? String(data.notes) : null,
      now,
      now,
    ],
  );
  return mapColaRegistration(rows[0]);
}

export async function updateColaRegistration(id: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `UPDATE cola_registrations SET
       product_name = COALESCE($2, product_name),
       brand_name = COALESCE($3, brand_name),
       class_type = COALESCE($4, class_type),
       formula_number = $5,
       cola_number = $6,
       status = COALESCE($7, status),
       applied_at = $8,
       approved_at = $9,
       expires_at = $10,
       notes = $11,
       updated_at = $12
     WHERE id = $1 AND tenant_id = $13 RETURNING *`,
    [
      id,
      data.productName != null ? String(data.productName) : null,
      data.brandName != null ? String(data.brandName) : null,
      data.classType != null ? String(data.classType) : null,
      data.formulaNumber != null && String(data.formulaNumber).trim() !== "" ? String(data.formulaNumber) : null,
      data.colaNumber != null && String(data.colaNumber).trim() !== "" ? String(data.colaNumber) : null,
      data.status != null ? String(data.status) : null,
      data.appliedAt != null && String(data.appliedAt).trim() !== "" ? String(data.appliedAt) : null,
      data.approvedAt != null && String(data.approvedAt).trim() !== "" ? String(data.approvedAt) : null,
      data.expiresAt != null && String(data.expiresAt).trim() !== "" ? String(data.expiresAt) : null,
      data.notes != null && String(data.notes).trim() !== "" ? String(data.notes) : null,
      now,
      tenantId,
    ],
  );
  if (!rows[0]) throw new Error("COLA registration not found");
  return mapColaRegistration(rows[0]);
}

export async function deleteColaRegistration(id: string) {
  const tenantId = getCurrentTenantId();
  await query("DELETE FROM cola_registrations WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export async function getLabelRecords() {
  const tenantId = getCurrentTenantId();
  const rows = await query("SELECT * FROM label_records WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
  return rows.map(mapLabelRecord);
}

export async function createLabelRecord(data: Record<string, unknown>) {
  const id = generateId("LBL");
  const now = new Date().toISOString();
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `INSERT INTO label_records (id, tenant_id, product_name, sku, version, cola_id, net_contents, alcohol_content, class_type, status, approved_at, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      id,
      tenantId,
      String(data.productName ?? ""),
      String(data.sku ?? ""),
      String(data.version ?? "1.0"),
      data.colaId != null && String(data.colaId).trim() !== "" ? String(data.colaId) : null,
      data.netContents != null && String(data.netContents).trim() !== "" ? String(data.netContents) : null,
      data.alcoholContent != null && String(data.alcoholContent).trim() !== "" ? Number(data.alcoholContent) : null,
      String(data.classType ?? ""),
      String(data.status ?? "draft"),
      data.approvedAt != null && String(data.approvedAt).trim() !== "" ? String(data.approvedAt) : null,
      data.notes != null && String(data.notes).trim() !== "" ? String(data.notes) : null,
      now,
      now,
    ],
  );
  return mapLabelRecord(rows[0]);
}

export async function updateLabelRecord(id: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `UPDATE label_records SET
       product_name = COALESCE($2, product_name),
       sku = COALESCE($3, sku),
       version = COALESCE($4, version),
       cola_id = $5,
       net_contents = $6,
       alcohol_content = $7,
       class_type = COALESCE($8, class_type),
       status = COALESCE($9, status),
       approved_at = $10,
       notes = $11,
       updated_at = $12
     WHERE id = $1 AND tenant_id = $13 RETURNING *`,
    [
      id,
      data.productName != null ? String(data.productName) : null,
      data.sku != null ? String(data.sku) : null,
      data.version != null ? String(data.version) : null,
      data.colaId != null && String(data.colaId).trim() !== "" ? String(data.colaId) : null,
      data.netContents != null && String(data.netContents).trim() !== "" ? String(data.netContents) : null,
      data.alcoholContent != null && String(data.alcoholContent).trim() !== "" ? Number(data.alcoholContent) : null,
      data.classType != null ? String(data.classType) : null,
      data.status != null ? String(data.status) : null,
      data.approvedAt != null && String(data.approvedAt).trim() !== "" ? String(data.approvedAt) : null,
      data.notes != null && String(data.notes).trim() !== "" ? String(data.notes) : null,
      now,
      tenantId,
    ],
  );
  if (!rows[0]) throw new Error("Label record not found");
  return mapLabelRecord(rows[0]);
}

export async function deleteLabelRecord(id: string) {
  const tenantId = getCurrentTenantId();
  await query("DELETE FROM label_records WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export async function getStateExciseReturns() {
  const tenantId = getCurrentTenantId();
  const rows = await query("SELECT * FROM state_excise_returns WHERE tenant_id = $1 ORDER BY period_start DESC", [tenantId]);
  return rows.map(mapStateExciseReturn);
}

export async function createStateExciseReturn(data: Record<string, unknown>) {
  const id = generateId("SER");
  const now = new Date().toISOString();
  const proofGallons = Number(data.totalProofGallons ?? 0);
  const rate = Number(data.ratePerProofGallon ?? 0);
  const totalTax = Math.round(proofGallons * rate * 100) / 100;
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `INSERT INTO state_excise_returns (id, tenant_id, state, period_start, period_end, due_date, status, total_proof_gallons, rate_per_proof_gallon, total_tax, filed_at, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      id,
      tenantId,
      String(data.state ?? ""),
      String(data.periodStart ?? ""),
      String(data.periodEnd ?? ""),
      String(data.dueDate ?? ""),
      String(data.status ?? "draft"),
      proofGallons,
      rate,
      totalTax,
      data.filedAt != null && String(data.filedAt).trim() !== "" ? String(data.filedAt) : null,
      data.notes != null && String(data.notes).trim() !== "" ? String(data.notes) : null,
      now,
      now,
    ],
  );
  return mapStateExciseReturn(rows[0]);
}

export async function updateStateExciseReturn(id: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const proofGallons = data.totalProofGallons != null ? Number(data.totalProofGallons) : null;
  const rate = data.ratePerProofGallon != null ? Number(data.ratePerProofGallon) : null;
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `UPDATE state_excise_returns SET
       state = COALESCE($2, state),
       period_start = COALESCE($3, period_start),
       period_end = COALESCE($4, period_end),
       due_date = COALESCE($5, due_date),
       status = COALESCE($6, status),
       total_proof_gallons = COALESCE($7, total_proof_gallons),
       rate_per_proof_gallon = COALESCE($8, rate_per_proof_gallon),
       total_tax = CASE
         WHEN $7 IS NOT NULL OR $8 IS NOT NULL
         THEN COALESCE($7, total_proof_gallons) * COALESCE($8, rate_per_proof_gallon)
         ELSE total_tax
       END,
       filed_at = $9,
       notes = $10,
       updated_at = $11
     WHERE id = $1 AND tenant_id = $12 RETURNING *`,
    [
      id,
      data.state != null ? String(data.state) : null,
      data.periodStart != null ? String(data.periodStart) : null,
      data.periodEnd != null ? String(data.periodEnd) : null,
      data.dueDate != null ? String(data.dueDate) : null,
      data.status != null ? String(data.status) : null,
      proofGallons,
      rate,
      data.filedAt != null && String(data.filedAt).trim() !== "" ? String(data.filedAt) : null,
      data.notes != null && String(data.notes).trim() !== "" ? String(data.notes) : null,
      now,
      tenantId,
    ],
  );
  if (!rows[0]) throw new Error("State excise return not found");
  return mapStateExciseReturn(rows[0]);
}

export async function deleteStateExciseReturn(id: string) {
  const tenantId = getCurrentTenantId();
  await query("DELETE FROM state_excise_returns WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export const storage: IStorage = new PostgresStorage();
