import assert from "node:assert/strict";
import test from "node:test";
import type { Barrel, InventoryLot } from "@shared/schema";
import {
  buildDistilleryReadinessMetrics,
  prepareBarrelEventForBarrel,
  prepareInventoryMovementForLot,
} from "./distillery-ops";

function createLot(overrides: Partial<InventoryLot> = {}): InventoryLot {
  return {
    id: "LOT-1",
    itemId: "INV-1",
    batchId: null,
    lotCode: "NM-2401",
    quantity: 100,
    unitOfMeasure: "gallons",
    abv: 60,
    proofGallons: 60,
    locationId: "BOND-A",
    receivedAt: "2026-01-10",
    expiresAt: null,
    notes: null,
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    ...overrides,
  };
}

function createBarrel(overrides: Partial<Barrel> = {}): Barrel {
  return {
    id: "BARREL-1",
    serialNumber: "BRL-26001",
    fillDate: "2025-01-01",
    fillProof: 120,
    fillVolume: 53,
    currentVolume: 49,
    status: "Aging",
    locationId: "RICK-1",
    warehouseZone: "A-1",
    charLevel: "#3",
    originBatchId: "BATCH-1",
    notes: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("prepareInventoryMovementForLot rejects overdraw for outbound movements", () => {
  const lot = createLot({ quantity: 40 });
  assert.throws(
    () =>
      prepareInventoryMovementForLot(lot, {
        lotId: lot.id,
        movementType: "Bottle",
        quantity: 50,
      }),
    /overdraw lot/i,
  );
});

test("prepareInventoryMovementForLot applies server-side lot synchronization snapshot", () => {
  const lot = createLot({ quantity: 100, abv: 60, proofGallons: 60, locationId: "BOND-A" });
  const prepared = prepareInventoryMovementForLot(
    lot,
    {
      lotId: lot.id,
      movementType: "Consume",
      quantity: 10,
      toLocationId: "PROCESS-1",
    },
    "Cellar Team",
  );

  assert.equal(prepared.movement.performedBy, "Cellar Team");
  assert.equal(prepared.after.quantity, 90);
  assert.equal(prepared.after.proofGallons, 54);
  assert.equal(prepared.after.locationId, "PROCESS-1");
  assert.equal(prepared.lotUpdates?.quantity, 90);
  assert.equal(prepared.lotUpdates?.proofGallons, 54);
});

test("prepareBarrelEventForBarrel supports empty event without explicit volume", () => {
  const barrel = createBarrel({ currentVolume: 32, status: "Ready" });
  const prepared = prepareBarrelEventForBarrel(barrel, {
    barrelId: barrel.id,
    eventType: "Empty",
  });

  assert.equal(prepared.event.volumeChange, 32);
  assert.equal(prepared.barrelUpdates?.currentVolume, 0);
  assert.equal(prepared.barrelUpdates?.status, "Retired");
});

test("prepareBarrelEventForBarrel rejects transfer records with no location information", () => {
  const barrel = createBarrel();
  assert.throws(
    () =>
      prepareBarrelEventForBarrel(barrel, {
        barrelId: barrel.id,
        eventType: "Transfer",
      }),
    /require at least one location/i,
  );
});

test("buildDistilleryReadinessMetrics summarizes transfer and proofing issues", () => {
  const lotWithMismatch = createLot({ id: "LOT-MISMATCH", proofGallons: 40, quantity: 100, abv: 60 });
  const lotMissingProof = createLot({ id: "LOT-MISSING", proofGallons: null, quantity: 20, abv: 50 });
  const barrel = createBarrel({ id: "BARREL-EVAP", fillVolume: 53, currentVolume: 42, fillDate: "2024-01-01" });

  const metrics = buildDistilleryReadinessMetrics({
    lots: [lotWithMismatch, lotMissingProof],
    movements: [
      {
        id: "MOVE-1",
        lotId: lotWithMismatch.id,
        movementType: "Transfer",
        quantity: 10,
        ttbOperationCategory: null,
        productionStage: null,
        taxClassification: null,
        fromLocationId: "BOND-A",
        toLocationId: null,
        reason: null,
        performedBy: null,
        performedAt: "2026-02-01T00:00:00.000Z",
        metadata: {},
      },
    ],
    barrels: [barrel],
    barrelEvents: [],
    now: new Date("2026-02-13T00:00:00.000Z"),
  });

  assert.equal(metrics.bondedTransferDiscipline.totalTransfers, 1);
  assert.equal(metrics.bondedTransferDiscipline.missingLocationCount, 1);
  assert.equal(metrics.proofingIntegrity.proofMismatchCount, 1);
  assert.equal(metrics.proofingIntegrity.lotsMissingProofGallonsCount, 1);
  assert.equal(metrics.barrelHealth.evaporationAlertCount, 1);
  assert.equal(metrics.operationHygiene.untaggedOperationCount, 1);
});
