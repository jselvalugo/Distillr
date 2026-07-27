import type {
  Barrel,
  BarrelEvent,
  InsertBarrel,
  InsertBarrelEvent,
  InsertInventoryLot,
  InsertInventoryMovement,
  InventoryLot,
  InventoryMovement,
} from "@shared/schema";

const EPSILON = 0.0001;
const PROOF_MISMATCH_THRESHOLD_GALLONS = 0.5;
const HIGH_EVAPORATION_ALERT_PERCENT_ANNUAL = 8;

type TransferLikeRecord = {
  fromLocationId?: string | null;
  toLocationId?: string | null;
};

type QuantitySnapshot = {
  quantity: number;
  locationId: string | null;
  proofGallons: number | null;
};

type VolumeSnapshot = {
  currentVolume: number;
  locationId: string | null;
  status: Barrel["status"];
};

export type PreparedInventoryMovement = {
  movement: InsertInventoryMovement;
  lotUpdates: Partial<InsertInventoryLot> | null;
  before: QuantitySnapshot;
  after: QuantitySnapshot;
};

export type PreparedBarrelEvent = {
  event: InsertBarrelEvent;
  barrelUpdates: Partial<InsertBarrel> | null;
  before: VolumeSnapshot;
  after: VolumeSnapshot;
};

export type DistilleryReadinessMetrics = {
  bondedTransferDiscipline: {
    totalTransfers: number;
    missingLocationCount: number;
    sameLocationCount: number;
    disciplinePercent: number;
  };
  proofingIntegrity: {
    lotsWithAbvCount: number;
    lotsMissingProofGallonsCount: number;
    proofMismatchCount: number;
    mismatchThresholdGallons: number;
  };
  barrelHealth: {
    activeBarrelCount: number;
    volumeAnomalyCount: number;
    evaporationAlertCount: number;
    highEvaporationBarrels: Array<{
      barrelId: string;
      serialNumber: string;
      annualizedLossPercent: number;
      ageDays: number;
    }>;
  };
  operationHygiene: {
    untaggedOperationCount: number;
    zeroQuantityOperationCount: number;
    futureDatedOperationCount: number;
  };
};

function roundNumber(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function hasValueChanged(left: number, right: number): boolean {
  return Math.abs(left - right) > EPSILON;
}

function evaluateTransferQuality(records: TransferLikeRecord[]) {
  const totalTransfers = records.length;
  let missingLocationCount = 0;
  let sameLocationCount = 0;

  for (const record of records) {
    const fromLocationId = normalizeNullableText(record.fromLocationId);
    const toLocationId = normalizeNullableText(record.toLocationId);
    if (!fromLocationId || !toLocationId) {
      missingLocationCount += 1;
      continue;
    }
    if (fromLocationId === toLocationId) sameLocationCount += 1;
  }

  const validCount = Math.max(0, totalTransfers - missingLocationCount - sameLocationCount);
  return {
    totalTransfers,
    missingLocationCount,
    sameLocationCount,
    disciplinePercent: totalTransfers === 0 ? 100 : roundNumber((validCount / totalTransfers) * 100, 1),
  };
}

function buildMovementMetadata(
  movement: InsertInventoryMovement,
  before: QuantitySnapshot,
  after: QuantitySnapshot,
): Record<string, unknown> {
  return {
    ...normalizeMetadata(movement.metadata),
    serverLedgerSync: {
      beforeQuantity: before.quantity,
      afterQuantity: after.quantity,
      beforeLocationId: before.locationId,
      afterLocationId: after.locationId,
      beforeProofGallons: before.proofGallons,
      afterProofGallons: after.proofGallons,
    },
  };
}

function buildBarrelEventMetadata(
  event: InsertBarrelEvent,
  before: VolumeSnapshot,
  after: VolumeSnapshot,
): Record<string, unknown> {
  return {
    ...normalizeMetadata(event.metadata),
    serverLedgerSync: {
      beforeCurrentVolume: before.currentVolume,
      afterCurrentVolume: after.currentVolume,
      beforeLocationId: before.locationId,
      afterLocationId: after.locationId,
      beforeStatus: before.status,
      afterStatus: after.status,
    },
  };
}

function ensurePositiveMagnitude(value: number, message: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }
  return value;
}

function ensureLocationDelta(fromLocationId: string | null, toLocationId: string | null): void {
  if (!fromLocationId && !toLocationId) {
    throw new Error("Transfer records require at least one location.");
  }
  if (fromLocationId && toLocationId && fromLocationId === toLocationId) {
    throw new Error("Transfer origin and destination must be different.");
  }
}

export function prepareInventoryMovementForLot(
  lot: InventoryLot,
  movement: InsertInventoryMovement,
  actorName?: string | null,
): PreparedInventoryMovement {
  const movementType = movement.movementType;
  const rawQuantity = Number(movement.quantity);
  if (!Number.isFinite(rawQuantity) || Math.abs(rawQuantity) <= EPSILON) {
    throw new Error("Movement quantity must be a non-zero number.");
  }
  if (movementType !== "Adjust" && rawQuantity < 0) {
    throw new Error(`${movementType} movements require a positive quantity.`);
  }

  const fromLocationId = normalizeNullableText(movement.fromLocationId);
  const toLocationId = normalizeNullableText(movement.toLocationId);
  if (movementType === "Transfer") {
    ensureLocationDelta(fromLocationId, toLocationId);
  }

  const currentQuantity = Number.isFinite(lot.quantity) ? lot.quantity : 0;
  const magnitude = Math.abs(rawQuantity);
  let quantityForRecord = movementType === "Adjust" ? rawQuantity : magnitude;
  let nextQuantity = currentQuantity;

  if (movementType === "Receive") {
    nextQuantity = currentQuantity + magnitude;
    quantityForRecord = magnitude;
  } else if (movementType === "Transfer") {
    nextQuantity = currentQuantity;
    quantityForRecord = magnitude;
  } else if (movementType === "Adjust") {
    nextQuantity = currentQuantity + rawQuantity;
  } else {
    nextQuantity = currentQuantity - magnitude;
    quantityForRecord = magnitude;
  }

  if (nextQuantity < -EPSILON) {
    throw new Error(`Movement would overdraw lot ${lot.lotCode}. Available quantity: ${roundNumber(currentQuantity)}.`);
  }
  nextQuantity = roundNumber(Math.max(0, nextQuantity));

  const nextLocationId = toLocationId || normalizeNullableText(lot.locationId);
  const currentProofGallons = lot.proofGallons === null || lot.proofGallons === undefined ? null : lot.proofGallons;
  const nextProofGallons =
    lot.abv === null || lot.abv === undefined ? currentProofGallons : roundNumber((nextQuantity * lot.abv) / 100);

  const lotUpdates: Partial<InsertInventoryLot> = {};
  if (hasValueChanged(nextQuantity, currentQuantity)) {
    lotUpdates.quantity = nextQuantity;
    if (nextProofGallons !== null) lotUpdates.proofGallons = nextProofGallons;
  }
  if (nextLocationId !== normalizeNullableText(lot.locationId)) {
    lotUpdates.locationId = nextLocationId;
  }

  const before: QuantitySnapshot = {
    quantity: currentQuantity,
    locationId: normalizeNullableText(lot.locationId),
    proofGallons: currentProofGallons,
  };
  const after: QuantitySnapshot = {
    quantity: nextQuantity,
    locationId: nextLocationId,
    proofGallons: nextProofGallons,
  };

  const normalizedMovement: InsertInventoryMovement = {
    ...movement,
    quantity: quantityForRecord,
    fromLocationId,
    toLocationId,
    performedBy: normalizeNullableText(movement.performedBy) || normalizeNullableText(actorName),
    metadata: buildMovementMetadata(movement, before, after),
  };

  return {
    movement: normalizedMovement,
    lotUpdates: Object.keys(lotUpdates).length ? lotUpdates : null,
    before,
    after,
  };
}

export function prepareBarrelEventForBarrel(
  barrel: Barrel,
  event: InsertBarrelEvent,
  actorName?: string | null,
): PreparedBarrelEvent {
  const eventType = event.eventType;
  const rawVolume = event.volumeChange;
  const fromLocationId = normalizeNullableText(event.fromLocationId);
  const toLocationId = normalizeNullableText(event.toLocationId);

  if (eventType === "Transfer") {
    ensureLocationDelta(fromLocationId, toLocationId);
  }

  const currentVolume = barrel.currentVolume === null || barrel.currentVolume === undefined ? 0 : barrel.currentVolume;
  let resolvedVolumeChange: number | null = rawVolume === null || rawVolume === undefined ? null : Number(rawVolume);
  if (resolvedVolumeChange !== null && !Number.isFinite(resolvedVolumeChange)) {
    throw new Error("Volume change must be a valid number.");
  }
  if (resolvedVolumeChange !== null && resolvedVolumeChange < 0) {
    throw new Error("Volume change must be entered as a positive value.");
  }

  let nextVolume = currentVolume;

  if (eventType === "Fill" || eventType === "TopOff") {
    resolvedVolumeChange = ensurePositiveMagnitude(
      resolvedVolumeChange ?? 0,
      `${eventType} events require a positive volume change.`,
    );
    nextVolume = currentVolume + resolvedVolumeChange;
  }

  if (eventType === "Sample") {
    resolvedVolumeChange = ensurePositiveMagnitude(
      resolvedVolumeChange ?? 0,
      "Sample events require a positive volume change.",
    );
    if (resolvedVolumeChange > currentVolume + EPSILON) {
      throw new Error(`Sample event exceeds barrel volume. Available volume: ${roundNumber(currentVolume)} gallons.`);
    }
    nextVolume = currentVolume - resolvedVolumeChange;
  }

  if (eventType === "Dump") {
    if (resolvedVolumeChange !== null) {
      resolvedVolumeChange = ensurePositiveMagnitude(
        resolvedVolumeChange,
        "Dump events require a positive volume change.",
      );
      if (resolvedVolumeChange > currentVolume + EPSILON) {
        throw new Error(`Dump event exceeds barrel volume. Available volume: ${roundNumber(currentVolume)} gallons.`);
      }
      nextVolume = currentVolume - resolvedVolumeChange;
    } else {
      resolvedVolumeChange = currentVolume;
      nextVolume = 0;
    }
  }

  if (eventType === "Empty" || eventType === "Retire") {
    if (resolvedVolumeChange !== null) {
      resolvedVolumeChange = ensurePositiveMagnitude(
        resolvedVolumeChange,
        `${eventType} events require a positive volume change.`,
      );
      if (resolvedVolumeChange > currentVolume + EPSILON) {
        throw new Error(`${eventType} event exceeds barrel volume. Available volume: ${roundNumber(currentVolume)} gallons.`);
      }
      nextVolume = currentVolume - resolvedVolumeChange;
    } else {
      resolvedVolumeChange = currentVolume;
      nextVolume = 0;
    }
  }

  if (nextVolume < -EPSILON) {
    throw new Error("Barrel volume cannot be negative after event processing.");
  }
  nextVolume = roundNumber(Math.max(0, nextVolume));

  let nextStatus = barrel.status;
  if (eventType === "Fill") nextStatus = "Filled";
  if (eventType === "Dump") nextStatus = "Dumped";
  if (eventType === "Empty" || eventType === "Retire") nextStatus = "Retired";

  const nextLocationId = toLocationId || normalizeNullableText(barrel.locationId);

  const before: VolumeSnapshot = {
    currentVolume,
    locationId: normalizeNullableText(barrel.locationId),
    status: barrel.status,
  };
  const after: VolumeSnapshot = {
    currentVolume: nextVolume,
    locationId: nextLocationId,
    status: nextStatus,
  };

  const barrelUpdates: Partial<InsertBarrel> = {};
  if (hasValueChanged(nextVolume, currentVolume)) {
    barrelUpdates.currentVolume = nextVolume;
  }
  if (nextLocationId !== normalizeNullableText(barrel.locationId)) {
    barrelUpdates.locationId = nextLocationId;
  }
  if (nextStatus !== barrel.status) {
    barrelUpdates.status = nextStatus;
  }

  const proofAtEvent =
    event.proofAtEvent === null || event.proofAtEvent === undefined
      ? barrel.fillProof ?? null
      : event.proofAtEvent;

  const normalizedEvent: InsertBarrelEvent = {
    ...event,
    volumeChange: resolvedVolumeChange,
    fromLocationId,
    toLocationId,
    proofAtEvent,
    performedBy: normalizeNullableText(event.performedBy) || normalizeNullableText(actorName),
    metadata: buildBarrelEventMetadata(event, before, after),
  };

  return {
    event: normalizedEvent,
    barrelUpdates: Object.keys(barrelUpdates).length ? barrelUpdates : null,
    before,
    after,
  };
}

export function buildDistilleryReadinessMetrics(params: {
  lots: InventoryLot[];
  movements: InventoryMovement[];
  barrels: Barrel[];
  barrelEvents: BarrelEvent[];
  now?: Date;
}): DistilleryReadinessMetrics {
  const now = params.now ?? new Date();

  const movementTransfers = params.movements
    .filter((movement) => movement.movementType === "Transfer")
    .map((movement) => ({ fromLocationId: movement.fromLocationId, toLocationId: movement.toLocationId }));
  const barrelTransfers = params.barrelEvents
    .filter((event) => event.eventType === "Transfer")
    .map((event) => ({ fromLocationId: event.fromLocationId, toLocationId: event.toLocationId }));
  const bondedTransferDiscipline = evaluateTransferQuality([...movementTransfers, ...barrelTransfers]);

  let lotsWithAbvCount = 0;
  let lotsMissingProofGallonsCount = 0;
  let proofMismatchCount = 0;
  for (const lot of params.lots) {
    if (lot.abv === null || lot.abv === undefined) continue;
    lotsWithAbvCount += 1;
    const expectedProof = (lot.quantity * lot.abv) / 100;
    if (lot.proofGallons === null || lot.proofGallons === undefined) {
      lotsMissingProofGallonsCount += 1;
      continue;
    }
    if (Math.abs(lot.proofGallons - expectedProof) > PROOF_MISMATCH_THRESHOLD_GALLONS) {
      proofMismatchCount += 1;
    }
  }

  const activeStatuses: Barrel["status"][] = ["Filled", "Aging", "Ready"];
  const activeBarrels = params.barrels.filter((barrel) => activeStatuses.includes(barrel.status));
  let volumeAnomalyCount = 0;
  const evaporationAlerts: DistilleryReadinessMetrics["barrelHealth"]["highEvaporationBarrels"] = [];

  for (const barrel of params.barrels) {
    const currentVolume = barrel.currentVolume ?? 0;
    const fillVolume = barrel.fillVolume ?? 0;
    if (currentVolume < -EPSILON) volumeAnomalyCount += 1;
    if (fillVolume > 0 && currentVolume > fillVolume + Math.max(0.25, fillVolume * 0.02)) {
      volumeAnomalyCount += 1;
    }
    if (["Dumped", "Retired"].includes(barrel.status) && currentVolume > 0.5) {
      volumeAnomalyCount += 1;
    }
    if (activeStatuses.includes(barrel.status) && currentVolume <= EPSILON) {
      volumeAnomalyCount += 1;
    }
  }

  for (const barrel of activeBarrels) {
    const fillVolume = barrel.fillVolume ?? null;
    const currentVolume = barrel.currentVolume ?? null;
    const fillDate = barrel.fillDate ? new Date(barrel.fillDate) : null;
    if (!fillDate || Number.isNaN(fillDate.getTime())) continue;
    if (fillVolume === null || currentVolume === null || fillVolume <= 0) continue;

    const ageDays = Math.max(1, Math.round((now.getTime() - fillDate.getTime()) / (1000 * 60 * 60 * 24)));
    if (ageDays < 30) continue;
    const observedLossPercent = ((fillVolume - currentVolume) / fillVolume) * 100;
    if (observedLossPercent <= 0) continue;

    const annualizedLossPercent = observedLossPercent / (ageDays / 365);
    if (annualizedLossPercent >= HIGH_EVAPORATION_ALERT_PERCENT_ANNUAL) {
      evaporationAlerts.push({
        barrelId: barrel.id,
        serialNumber: barrel.serialNumber,
        annualizedLossPercent: roundNumber(annualizedLossPercent, 2),
        ageDays,
      });
    }
  }

  evaporationAlerts.sort((left, right) => right.annualizedLossPercent - left.annualizedLossPercent);

  const allOperations = [...params.movements, ...params.barrelEvents];
  const untaggedOperationCount = allOperations.filter((operation) => {
    const operationCategory = "ttbOperationCategory" in operation ? operation.ttbOperationCategory : null;
    const productionStage = "productionStage" in operation ? operation.productionStage : null;
    const taxClassification = "taxClassification" in operation ? operation.taxClassification : null;
    return !(operationCategory && productionStage && taxClassification);
  }).length;
  const zeroQuantityOperationCount =
    params.movements.filter((movement) => Math.abs(movement.quantity) <= EPSILON).length +
    params.barrelEvents.filter((event) => {
      if (event.eventType === "Transfer") return false;
      return event.volumeChange === null || event.volumeChange === undefined || Math.abs(event.volumeChange) <= EPSILON;
    }).length;

  const futureThresholdMs = now.getTime() + 5 * 60 * 1000;
  const futureDatedOperationCount =
    params.movements.filter((movement) => {
      const parsed = new Date(movement.performedAt);
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() > futureThresholdMs;
    }).length +
    params.barrelEvents.filter((event) => {
      const parsed = new Date(event.eventAt);
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() > futureThresholdMs;
    }).length;

  return {
    bondedTransferDiscipline,
    proofingIntegrity: {
      lotsWithAbvCount,
      lotsMissingProofGallonsCount,
      proofMismatchCount,
      mismatchThresholdGallons: PROOF_MISMATCH_THRESHOLD_GALLONS,
    },
    barrelHealth: {
      activeBarrelCount: activeBarrels.length,
      volumeAnomalyCount,
      evaporationAlertCount: evaporationAlerts.length,
      highEvaporationBarrels: evaporationAlerts.slice(0, 5),
    },
    operationHygiene: {
      untaggedOperationCount,
      zeroQuantityOperationCount,
      futureDatedOperationCount,
    },
  };
}
