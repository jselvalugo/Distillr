import { z } from "zod";

// Production Batch (legacy jobs endpoint)
export const batchStatuses = ["Scheduled", "In Progress", "Completed", "Blocked"] as const;
export const batchPriorities = ["Low", "Normal", "High"] as const;

export const jobSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  address: z.string(),
  service: z.string(),
  serviceCategory: z.string().nullable().optional(),
  status: z.enum(batchStatuses),
  startTime: z.string(),
  endTime: z.string(),
  crew: z.array(z.string()),
  priority: z.enum(batchPriorities),
  blockReason: z.string().optional(),
  scheduledDate: z.string(),
  assignedUserId: z.string().nullable().optional(),
  workOrderNumber: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  completionNotes: z.string().nullable().optional(),
  afterPhotos: z.array(z.string()).optional(),
});

export const insertJobSchema = jobSchema.partial({ id: true, scheduledDate: true, assignedUserId: true, afterPhotos: true });

export type Job = z.infer<typeof jobSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;

export const jobPhotoSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  filename: z.string(),
  filePath: z.string(),
  uploadedBy: z.string(),
  uploadedAt: z.string(),
});

export const insertJobPhotoSchema = jobPhotoSchema.omit({ id: true, uploadedAt: true });

export type JobPhoto = z.infer<typeof jobPhotoSchema>;
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;

// Attachments (documents + evidence)
export const attachmentDocTypes = [
  "COI",
  "MASTER_AGREEMENT",
  "DSP_PERMIT",
  "COLA",
  "EXCISE_TAX",
  "TTB_REPORT",
  "SAFETY_INSPECTION",
  "OTHER",
] as const;

export const attachmentStatuses = ["active", "superseded", "revoked"] as const;

export const attachmentDocTypeSchema = z.enum(attachmentDocTypes);
export const attachmentStatusSchema = z.enum(attachmentStatuses);

export const attachmentSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  filePath: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int().nonnegative(),
  sha256: z.string().nullable().optional(),
  docType: attachmentDocTypeSchema,
  effectiveOn: z.string().nullable().optional(),
  expiresOn: z.string().nullable().optional(),
  status: attachmentStatusSchema,
  uploadedBy: z.string(),
  uploadedAt: z.string(),
  notes: z.string().nullable().optional(),
});

export const insertAttachmentSchema = attachmentSchema.omit({ id: true, uploadedAt: true });

export type Attachment = z.infer<typeof attachmentSchema>;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;

export const attachmentLinkSchema = z.object({
  id: z.string(),
  attachmentId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  relationship: z.string(),
  linkedBy: z.string(),
  linkedAt: z.string(),
});

export const insertAttachmentLinkSchema = attachmentLinkSchema.omit({ id: true, linkedAt: true });

export type AttachmentLink = z.infer<typeof attachmentLinkSchema>;
export type InsertAttachmentLink = z.infer<typeof insertAttachmentLinkSchema>;

// Trading Partners (legacy clients endpoint)
export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  legalName: z.string().nullable().optional(),
  dba: z.string().nullable().optional(),
  type: z.string(),
  contact: z.string(),
  contactTitle: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  accountOwner: z.string().nullable().optional(),
  status: z.string(),
  website: z.string().nullable().optional(),
  supportEmail: z.string().nullable().optional(),
  supportPhone: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  headquartersAddress: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  industrySegment: z.string().nullable().optional(),
  accountTier: z.string().nullable().optional(),
  onboardingStatus: z.string().nullable().optional(),
  renewalDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  coiExpiresOn: z.string().nullable().optional(),
  serviceAgreementExpiresOn: z.string().nullable().optional(),
});

export const insertClientSchema = clientSchema.partial({ id: true });

export type Client = z.infer<typeof clientSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;

// Facilities (legacy properties endpoint)
export const propertySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  clientId: z.string(),
  type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  siteContact: z.string().nullable().optional(),
  siteContactPhone: z.string().nullable().optional(),
  accessNotes: z.string().nullable().optional(),
});

export const insertPropertySchema = propertySchema.partial({ id: true });

export type Property = z.infer<typeof propertySchema>;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

// Team Members
export const staffSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  status: z.string(),
  phone: z.string(),
  userId: z.string().nullable().optional(),
});

export const insertStaffSchema = staffSchema.partial({ id: true, userId: true });

export type Staff = z.infer<typeof staffSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;

// Compliance + Reporting support records
export const complianceSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  type: z.string(),
  regulatoryArea: z.string().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
  controlReference: z.string().nullable().optional(),
  status: z.string(),
  expires: z.string().nullable(),
  documentUrl: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  requiredFor: z.string().nullable().optional(),
  lastReviewedOn: z.string().nullable().optional(),
  retentionYears: z.number().int().positive().nullable().optional(),
  retentionUntil: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export const insertComplianceSchema = complianceSchema.partial({ id: true });

export type Compliance = z.infer<typeof complianceSchema>;
export type InsertCompliance = z.infer<typeof insertComplianceSchema>;

// Inventory
export const inventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  unitOfMeasure: z.string(),
  status: z.enum(["Active", "Archived"]),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertInventoryItemSchema = inventoryItemSchema.partial({
  id: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

export const inventoryLotSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  batchId: z.string().nullable().optional(),
  lotCode: z.string(),
  quantity: z.number(),
  unitOfMeasure: z.string(),
  abv: z.number().nullable().optional(),
  proofGallons: z.number().nullable().optional(),
  locationId: z.string().nullable().optional(),
  receivedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertInventoryLotSchema = inventoryLotSchema.partial({
  id: true,
  batchId: true,
  abv: true,
  proofGallons: true,
  locationId: true,
  receivedAt: true,
  expiresAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
});

export type InventoryLot = z.infer<typeof inventoryLotSchema>;
export type InsertInventoryLot = z.infer<typeof insertInventoryLotSchema>;

export const ttbOperationCategories = ["Storage", "Processing"] as const;
export const ttbFilingCadences = ["Semi-Monthly", "Monthly", "Quarterly", "Annual"] as const;
export const ttbReportTypes = [
  "Monthly Compliance Packet",
  "Production Operations",
  "Storage Operations",
  "Processing Operations",
  "Denaturing Operations",
  "Excise Tax Return",
] as const;
export const ttbProductionStages = [
  "Receipt",
  "Distillation",
  "Blending",
  "Storage",
  "Maturation",
  "Processing",
  "Bottling",
  "Transfer",
  "Removal",
] as const;
export const ttbTaxClassifications = [
  "In Bond",
  "Tax Paid",
  "Export",
  "Research/Development",
  "Industrial",
  "Destruction",
] as const;

export const inventoryMovementSchema = z.object({
  id: z.string(),
  lotId: z.string(),
  movementType: z.enum(["Receive", "Transfer", "Adjust", "Consume", "Bottle", "Dispose"]),
  quantity: z.number(),
  ttbOperationCategory: z.enum(ttbOperationCategories).nullable().optional(),
  productionStage: z.enum(ttbProductionStages).nullable().optional(),
  taxClassification: z.enum(ttbTaxClassifications).nullable().optional(),
  fromLocationId: z.string().nullable().optional(),
  toLocationId: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  performedBy: z.string().nullable().optional(),
  performedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const insertInventoryMovementSchema = inventoryMovementSchema.partial({
  id: true,
  fromLocationId: true,
  toLocationId: true,
  reason: true,
  performedBy: true,
  performedAt: true,
  metadata: true,
});

export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;

// Barrel Management
export const barrelSchema = z.object({
  id: z.string(),
  serialNumber: z.string(),
  productName: z.string().nullable().optional(),
  fillDate: z.string().nullable().optional(),
  fillProof: z.number().nullable().optional(),
  fillProofGallons: z.number().nullable().optional(),
  fillVolume: z.number().nullable().optional(),
  currentVolume: z.number().nullable().optional(),
  currentProofGallons: z.number().nullable().optional(),
  totalAgingDays: z.number().int().nonnegative().nullable().optional(),
  dumpDate: z.string().nullable().optional(),
  casesMade: z.number().int().nonnegative().nullable().optional(),
  percentBottled: z.number().nonnegative().max(100).nullable().optional(),
  lossesProofGallons: z.number().nullable().optional(),
  status: z.enum(["Filled", "Aging", "Ready", "Dumped", "Retired"]),
  locationId: z.string().nullable().optional(),
  warehouseZone: z.string().nullable().optional(),
  charLevel: z.string().nullable().optional(),
  originBatchId: z.string().nullable().optional(),
  colorNotes: z.string().nullable().optional(),
  noseNotes: z.string().nullable().optional(),
  samplePercentNotes: z.string().nullable().optional(),
  outdoorTemp: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertBarrelSchema = barrelSchema.partial({
  id: true,
  productName: true,
  fillDate: true,
  fillProof: true,
  fillProofGallons: true,
  fillVolume: true,
  currentVolume: true,
  currentProofGallons: true,
  totalAgingDays: true,
  dumpDate: true,
  casesMade: true,
  percentBottled: true,
  lossesProofGallons: true,
  locationId: true,
  warehouseZone: true,
  charLevel: true,
  originBatchId: true,
  colorNotes: true,
  noseNotes: true,
  samplePercentNotes: true,
  outdoorTemp: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
});

export type Barrel = z.infer<typeof barrelSchema>;
export type InsertBarrel = z.infer<typeof insertBarrelSchema>;

export const barrelEventSchema = z.object({
  id: z.string(),
  barrelId: z.string(),
  eventType: z.enum(["Fill", "Transfer", "Sample", "TopOff", "Dump", "Empty", "Retire", "gauge", "temperature", "dump"]),
  eventAt: z.string(),
  volumeChange: z.number().nullable().optional(),
  proofAtEvent: z.number().nullable().optional(),
  ttbOperationCategory: z.enum(ttbOperationCategories).nullable().optional(),
  productionStage: z.enum(ttbProductionStages).nullable().optional(),
  taxClassification: z.enum(ttbTaxClassifications).nullable().optional(),
  fromLocationId: z.string().nullable().optional(),
  toLocationId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  performedBy: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const insertBarrelEventSchema = barrelEventSchema.partial({
  id: true,
  eventAt: true,
  volumeChange: true,
  proofAtEvent: true,
  fromLocationId: true,
  toLocationId: true,
  notes: true,
  performedBy: true,
  metadata: true,
});

export type BarrelEvent = z.infer<typeof barrelEventSchema>;
export type InsertBarrelEvent = z.infer<typeof insertBarrelEventSchema>;

// TTB Reporting
export const ttbReportSchema = z.object({
  id: z.string(),
  reportPeriodStart: z.string(),
  reportPeriodEnd: z.string(),
  filingType: z.enum(ttbReportTypes).nullable().optional(),
  filingCadence: z.enum(ttbFilingCadences).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  exciseTaxDue: z.number().nullable().optional(),
  status: z.enum(["Draft", "Generated", "Approved", "Exported"]),
  generatedAt: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  approvedBy: z.string().nullable().optional(),
  exportedAt: z.string().nullable().optional(),
  retentionUntil: z.string().nullable().optional(),
  payload: z.record(z.unknown()),
  jsonPath: z.string().nullable().optional(),
  csvPath: z.string().nullable().optional(),
  pdfPath: z.string().nullable().optional(),
});

export const insertTtbReportSchema = ttbReportSchema.partial({
  id: true,
  filingType: true,
  filingCadence: true,
  dueDate: true,
  exciseTaxDue: true,
  status: true,
  generatedAt: true,
  approvedAt: true,
  approvedBy: true,
  exportedAt: true,
  retentionUntil: true,
  payload: true,
  jsonPath: true,
  csvPath: true,
  pdfPath: true,
});

export type TtbReport = z.infer<typeof ttbReportSchema>;
export type InsertTtbReport = z.infer<typeof insertTtbReportSchema>;

// Audit log
export const auditLogSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  actorName: z.string().nullable().optional(),
  actorRole: z.string().nullable().optional(),
  occurredAt: z.string(),
  details: z.record(z.unknown()),
});

export const insertAuditLogSchema = auditLogSchema.partial({
  id: true,
  actorName: true,
  actorRole: true,
  occurredAt: true,
  details: true,
});

export type AuditLog = z.infer<typeof auditLogSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Sales Orders
export const salesOrderStatuses = ["Draft", "Approved", "Fulfilled", "Cancelled"] as const;

export const salesOrderLineItemSchema = z.object({
  sku: z.string(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string().optional(),
  unitPrice: z.number(),
});

export const salesOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  clientId: z.string(),
  status: z.enum(salesOrderStatuses),
  orderDate: z.string(),
  requestedShipDate: z.string().nullable().optional(),
  fulfilledDate: z.string().nullable().optional(),
  totalAmount: z.number().nullable().optional(),
  currency: z.string(),
  notes: z.string().nullable().optional(),
  lineItems: z.array(salesOrderLineItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertSalesOrderSchema = salesOrderSchema.partial({
  id: true,
  status: true,
  requestedShipDate: true,
  fulfilledDate: true,
  totalAmount: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
});

export type SalesOrder = z.infer<typeof salesOrderSchema>;
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;

// Native Calculator Presets
export const calculationTypeSchema = z.enum([
  "proof_gallons",
  "abv_to_proof",
  "proof_to_abv",
  "dilution_water",
]);

export const calculatorPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  calculationType: calculationTypeSchema,
  parameters: z.record(z.number()),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertCalculatorPresetSchema = calculatorPresetSchema.partial({
  id: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
});

export type CalculatorPreset = z.infer<typeof calculatorPresetSchema>;
export type InsertCalculatorPreset = z.infer<typeof insertCalculatorPresetSchema>;

// Distilling production / bottling / sales workflow records
export const distillingBatchStages = [
  "planning",
  "mash_fermentation",
  "distillation",
  "barreling",
  "aging",
  "bottling",
  "closed",
] as const;
export const distillingBatchStatuses = ["Draft", "In Progress", "Completed", "Closed"] as const;

export const distillingBatchRecordSchema = z.object({
  id: z.string(),
  batchCode: z.string(),
  batchDate: z.string(),
  stage: z.enum(distillingBatchStages),
  status: z.enum(distillingBatchStatuses),
  productionRecordId: z.string().nullable().optional(),
  inventoryRecordId: z.string().nullable().optional(),
  salesOrderId: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  barrelId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Planning / Spirit classification
  spiritType: z.string().nullable().optional(),
  spiritClass: z.string().nullable().optional(),
  // Distillation TTB fields
  distillationProof: z.number().nullable().optional(),
  proofGallonsProduced: z.number().nullable().optional(),
  stillType: z.string().nullable().optional(),
  // Barreling TTB fields
  fillNumber: z.string().nullable().optional(),
  fillProof: z.number().nullable().optional(),
  fillWineGallons: z.number().nullable().optional(),
  fillProofGallons: z.number().nullable().optional(),
  containerType: z.string().nullable().optional(),
  // Bottling TTB fields
  bottlingDate: z.string().nullable().optional(),
  bottlingProof: z.number().nullable().optional(),
  wineGallonsBottled: z.number().nullable().optional(),
  proofGallonsProcessed: z.number().nullable().optional(),
  cases750ml: z.number().int().nullable().optional(),
  cases1000ml: z.number().int().nullable().optional(),
  cases1750ml: z.number().int().nullable().optional(),
  totalCases: z.number().int().nullable().optional(),
  lotNumber: z.string().nullable().optional(),
  taxClass: z.string().nullable().optional(),
  exciseTaxDue: z.number().nullable().optional(),
  distillDate: z.string().nullable().optional(),
  fillDate: z.string().nullable().optional(),
  targetDumpDate: z.string().nullable().optional(),
  amountReceivedGallons: z.number().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertDistillingBatchRecordSchema = distillingBatchRecordSchema.partial({
  id: true,
  status: true,
  productionRecordId: true,
  inventoryRecordId: true,
  salesOrderId: true,
  productName: true,
  barrelId: true,
  notes: true,
  spiritType: true,
  spiritClass: true,
  distillationProof: true,
  proofGallonsProduced: true,
  stillType: true,
  fillNumber: true,
  fillProof: true,
  fillWineGallons: true,
  fillProofGallons: true,
  containerType: true,
  bottlingDate: true,
  bottlingProof: true,
  wineGallonsBottled: true,
  proofGallonsProcessed: true,
  cases750ml: true,
  cases1000ml: true,
  cases1750ml: true,
  totalCases: true,
  lotNumber: true,
  taxClass: true,
  exciseTaxDue: true,
  distillDate: true,
  fillDate: true,
  targetDumpDate: true,
  amountReceivedGallons: true,
  createdAt: true,
  updatedAt: true,
});

export type DistillingBatchRecord = z.infer<typeof distillingBatchRecordSchema>;
export type InsertDistillingBatchRecord = z.infer<typeof insertDistillingBatchRecordSchema>;

export const distillingProductionRecordSchema = z.object({
  id: z.string(),
  batchRecordId: z.string().nullable().optional(),
  mashDate: z.string(),
  gallonsMolasses: z.number().nonnegative(),
  lbsSugar: z.number().nonnegative(),
  yeastDate: z.string().nullable().optional(),
  libertaliaYeastPackets: z.number().int().nonnegative(),
  riskeyYeastPackets: z.number().int().nonnegative(),
  distillDate: z.string(),
  gallonsDistilled: z.number().nonnegative(),
  percentageDistilled: z.number().nonnegative(),
  proofOfGallons: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertDistillingProductionRecordSchema = distillingProductionRecordSchema.partial({
  id: true,
  batchRecordId: true,
  yeastDate: true,
  proofOfGallons: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
});

export type DistillingProductionRecord = z.infer<typeof distillingProductionRecordSchema>;
export type InsertDistillingProductionRecord = z.infer<typeof insertDistillingProductionRecordSchema>;

export const distillingCasesMadeSchema = z.record(z.string(), z.number().int().nonnegative());
export const distillingCasesToDistributorsSchema = z.record(z.string(), z.number().int().nonnegative());
export const distillingCasesToRetailSchema = z.record(z.string(), z.number().int().nonnegative());
export const distillingBottlesMadeSchema = z.record(z.string(), z.number().int().nonnegative());

export type DistillingCasesMade = z.infer<typeof distillingCasesMadeSchema>;
export type DistillingCasesToDistributors = z.infer<typeof distillingCasesToDistributorsSchema>;
export type DistillingCasesToRetail = z.infer<typeof distillingCasesToRetailSchema>;
export type DistillingBottlesMade = z.infer<typeof distillingBottlesMadeSchema>;

export const distillingInventoryRecordSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  averageAbvPercent: z.number().nonnegative().max(100).nullable().optional(),
  batchRecordId: z.string().nullable().optional(),
  linkedBarrelId: z.string().nullable().optional(),
  reportMonth: z.string(),
  casesMade: distillingCasesMadeSchema,
  casesToDistributors: distillingCasesToDistributorsSchema,
  casesToRetail: distillingCasesToRetailSchema,
  bottlesMade: distillingBottlesMadeSchema,
  beginningOfMonthCases: z.number().int(),
  currentMonthInventory: z.number().int(),
  endingMonthInventory: z.number().int(),
  endingUsGallons: z.number(),
  endingProofGallons: z.number(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertDistillingInventoryRecordSchema = distillingInventoryRecordSchema.partial({
  id: true,
  title: true,
  productName: true,
  averageAbvPercent: true,
  batchRecordId: true,
  linkedBarrelId: true,
  beginningOfMonthCases: true,
  currentMonthInventory: true,
  endingMonthInventory: true,
  endingUsGallons: true,
  endingProofGallons: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
});

export type DistillingInventoryRecord = z.infer<typeof distillingInventoryRecordSchema>;
export type InsertDistillingInventoryRecord = z.infer<typeof insertDistillingInventoryRecordSchema>;

export const distilleryControlTowerSummarySchema = z.object({
  asOf: z.string(),
  reportMonth: z.string(),
  produced: z.object({
    recordCount: z.number().int().nonnegative(),
    gallonsDistilled: z.number().nonnegative(),
    proofGallons: z.number().nonnegative(),
  }),
  bottled: z.object({
    inventoryRecordCount: z.number().int().nonnegative(),
    casesMade: z.number().int().nonnegative(),
    bottlesMade: z.number().int().nonnegative(),
  }),
  sold: z.object({
    distributorCases: z.number().int().nonnegative(),
    retailCases: z.number().int().nonnegative(),
    totalCases: z.number().int().nonnegative(),
    salesOrdersApprovedOrFulfilled: z.number().int().nonnegative(),
  }),
  inventory: z.object({
    beginningOfMonthCases: z.number().int(),
    currentMonthInventory: z.number().int(),
    endingMonthInventory: z.number().int(),
    endingUsGallons: z.number(),
    endingProofGallons: z.number(),
  }),
});

export type DistilleryControlTowerSummary = z.infer<typeof distilleryControlTowerSummarySchema>;

export const statsSchema = z.object({
  scheduled: z.number(),
  inProgress: z.number(),
  completed: z.number(),
  blocked: z.number(),
});

export type Stats = z.infer<typeof statsSchema>;

// Platform Config
export const platformConfigSchema = z.object({
  organizationName: z.string(),
  organizationNameOverride: z.string().nullable().optional(),
  platformTagline: z.string(),
  industry: z.string(),
  supportEmail: z.string(),
  supportPhone: z.string(),
  website: z.string(),
  primaryAddress: z.string(),
  timeZone: z.string(),
  dspNumber: z.string().nullable().optional(),
  logoDataUrl: z.string().nullable().optional(),
  accountTypes: z.array(z.string()),
  accountStatuses: z.array(z.string()),
  accountIndustries: z.array(z.string()),
  accountTiers: z.array(z.string()),
  serviceCategories: z.array(z.string()),
  serviceCatalog: z.array(z.string()),
  locationTypes: z.array(z.string()),
  locationStatuses: z.array(z.string()),
  requirementTypes: z.array(z.string()),
  requirementStatuses: z.array(z.string()),
  requirementSeverities: z.array(z.string()),
});

export const updatePlatformConfigSchema = platformConfigSchema.partial();

export type PlatformConfig = z.infer<typeof platformConfigSchema>;
export type UpdatePlatformConfig = z.infer<typeof updatePlatformConfigSchema>;

export const defaultPlatformConfig: PlatformConfig = {
  organizationName: "OakCellar",
  platformTagline: "Distillery operations and compliance command center",
  industry: "Craft Distillery",
  supportEmail: "support@oakcellar.com",
  supportPhone: "(512) 555-0137",
  website: "https://oakcellar.com",
  primaryAddress: "100 Copper Still Lane, Austin, TX 78701",
  timeZone: "America/Chicago",
  accountTypes: ["Distributor", "Retailer", "Supplier", "Contract Partner", "Regulatory"],
  accountStatuses: ["Active", "Prospective", "Inactive"],
  accountIndustries: ["Spirits", "Beverage", "Packaging", "Logistics", "Regulatory"],
  accountTiers: ["Tier 1", "Tier 2", "Strategic", "Seasonal"],
  serviceCategories: ["Mash", "Fermentation", "Distillation", "Maturation", "Bottling", "QA"],
  serviceCatalog: [
    "New Make Distillation",
    "Barrel Fill Run",
    "Blending Run",
    "Proofing and Dilution",
    "Bottling Run",
    "Inventory Reconciliation",
  ],
  locationTypes: ["Distillery", "Rickhouse", "Warehouse", "Bonded Area", "Bottling Hall", "Lab"],
  locationStatuses: ["Active", "Maintenance", "Standby", "Inactive"],
  requirementTypes: [
    "DSP Permit",
    "COLA Documentation",
    "Excise Tax Filing",
    "State Excise Filing",
    "TTB Operational Report",
    "Production Log Review",
    "Storage Log Review",
    "GDPR/Privacy Control",
    "PCI DSS Control",
    "Fire Safety Inspection",
    "Internal Audit Packet",
  ],
  requirementStatuses: ["Approved", "Expiring Soon", "Missing", "Expired", "Pending Review"],
  requirementSeverities: ["Low", "Medium", "High", "Critical"],
};

// Auth
export const roleSchema = z.enum(["admin", "distiller", "cellar", "compliance", "inventory", "sales"]);
export const userManagementRoleSchema = z.enum(["admin", "distiller", "cellar"]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string(),
  role: roleSchema,
  status: z.enum(["active", "inactive"]),
  createdAt: z.string(),
});

export const insertUserSchema = userSchema.omit({ id: true, createdAt: true, passwordHash: true }).extend({
  role: userManagementRoleSchema,
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type SafeUser = Omit<User, "passwordHash"> & { tenantId: string };
