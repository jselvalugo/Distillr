import { storage } from "./storage";

function getDateStr(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split("T")[0];
}

export async function seedInitialData() {
  try {
    const existingJobs = await storage.getJobs();
    if (existingJobs.length > 0) return;

    await storage.createClient({
      id: "PARTNER-1",
      name: "Hill Country Beverage Distribution",
      legalName: "Hill Country Beverage Distribution LLC",
      type: "Distributor",
      contact: "Maya Bennett",
      contactEmail: "maya@hillcountrybev.local",
      contactPhone: "(512) 555-0140",
      status: "Active",
      industrySegment: "Spirits",
      accountTier: "Tier 1",
      paymentTerms: "Net 30",
      billingAddress: "2120 Logistics Ave, Austin, TX",
      headquartersAddress: "2120 Logistics Ave, Austin, TX",
    });

    await storage.createClient({
      id: "PARTNER-2",
      name: "Lone Star Glass Supply",
      legalName: "Lone Star Glass Supply Co.",
      type: "Supplier",
      contact: "Jordan Lee",
      contactEmail: "jordan@lsgs.local",
      contactPhone: "(713) 555-0188",
      status: "Active",
      industrySegment: "Packaging",
      accountTier: "Tier 2",
      paymentTerms: "Net 15",
      billingAddress: "980 Foundry Rd, Houston, TX",
      headquartersAddress: "980 Foundry Rd, Houston, TX",
    });

    await storage.createProperty({
      id: "FAC-1",
      name: "Main Distillery",
      address: "100 Copper Still Lane, Austin, TX",
      clientId: "PARTNER-1",
      type: "Distillery",
      status: "Active",
      region: "Plant A",
      accessNotes: "Badge required for bonded area",
    });

    await storage.createProperty({
      id: "FAC-2",
      name: "Rickhouse Alpha",
      address: "130 Barrel Row, Austin, TX",
      clientId: "PARTNER-1",
      type: "Rickhouse",
      status: "Active",
      region: "North Lot",
      accessNotes: "Forklift route only",
    });

    await storage.createJob({
      id: "BATCH-2401",
      propertyId: "FAC-1",
      address: "100 Copper Still Lane, Austin, TX",
      service: "New Make Distillation",
      serviceCategory: "Distillation",
      status: "In Progress",
      startTime: "07:00",
      endTime: "15:00",
      crew: ["Alex Turner", "Nina Patel"],
      priority: "High",
      scheduledDate: getDateStr(0),
      workOrderNumber: "WO-2401",
      estimatedMinutes: 480,
    });

    await storage.createJob({
      id: "BATCH-2402",
      propertyId: "FAC-1",
      address: "100 Copper Still Lane, Austin, TX",
      service: "Proofing and Dilution",
      serviceCategory: "QA",
      status: "Scheduled",
      startTime: "09:00",
      endTime: "12:00",
      crew: ["Diego Morales"],
      priority: "Normal",
      scheduledDate: getDateStr(1),
      workOrderNumber: "WO-2402",
      estimatedMinutes: 180,
    });

    await storage.createStaff({
      id: "TEAM-1",
      name: "Alex Turner",
      role: "Lead Distiller",
      status: "Active",
      phone: "(512) 555-0161",
    });

    await storage.createStaff({
      id: "TEAM-2",
      name: "Nina Patel",
      role: "Cellar Manager",
      status: "Active",
      phone: "(512) 555-0162",
    });

    await storage.createCompliance({
      id: "COMP-1",
      clientId: "PARTNER-1",
      type: "TTB Operational Report",
      status: "Pending Review",
      expires: getDateStr(10),
      severity: "High",
      requiredFor: "Federal monthly filing",
      owner: "Compliance Team",
    });

    const item = await storage.createInventoryItem({
      id: "INV-ETH-1",
      name: "New Make Spirit",
      category: "Bulk Spirit",
      unitOfMeasure: "gallons",
      status: "Active",
    });

    const lot = await storage.createInventoryLot({
      id: "LOT-2401A",
      itemId: item.id,
      batchId: "BATCH-2401",
      lotCode: "LOT-2401A",
      quantity: 120,
      unitOfMeasure: "gallons",
      abv: 62.5,
      proofGallons: 75,
      locationId: "FAC-1",
      receivedAt: new Date().toISOString(),
      notes: "Heads and tails removed, hearts retained",
    });

    await storage.createInventoryMovement({
      lotId: lot.id,
      movementType: "Receive",
      quantity: 120,
      ttbOperationCategory: "Storage",
      productionStage: "Receipt",
      taxClassification: "In Bond",
      toLocationId: "FAC-1",
      reason: "Batch completion",
      performedBy: "Alex Turner",
      metadata: { batchId: "BATCH-2401" },
    });

    const barrel = await storage.createBarrel({
      id: "BARREL-001",
      serialNumber: "BRL-24-0001",
      fillDate: getDateStr(0),
      fillProof: 125,
      fillVolume: 53,
      currentVolume: 53,
      status: "Filled",
      locationId: "FAC-2",
      warehouseZone: "A-1",
      charLevel: "#3",
      originBatchId: "BATCH-2401",
    });

    await storage.createBarrelEvent({
      barrelId: barrel.id,
      eventType: "Fill",
      eventAt: new Date().toISOString(),
      volumeChange: 53,
      proofAtEvent: 125,
      ttbOperationCategory: "Storage",
      productionStage: "Maturation",
      taxClassification: "In Bond",
      toLocationId: "FAC-2",
      performedBy: "Nina Patel",
      metadata: { lotId: lot.id },
    });

    await storage.createTtbReport({
      id: "TTP-2026-01",
      reportPeriodStart: "2026-01-01",
      reportPeriodEnd: "2026-01-31",
      status: "Draft",
      payload: {
        productionRuns: 12,
        totalProofGallonsProduced: 420,
        totalProofGallonsRemoved: 130,
      },
    });

    await storage.createSalesOrder({
      id: "SO-2026-001",
      orderNumber: "SO-2026-001",
      clientId: "PARTNER-1",
      status: "Approved",
      orderDate: "2026-02-01",
      requestedShipDate: "2026-02-15",
      totalAmount: 18250,
      currency: "USD",
      notes: "Ship bonded transfer with compliance packet attached.",
      lineItems: [
        {
          sku: "WHSK-750-RESERVE",
          description: "Small Batch Reserve 750ml",
          quantity: 400,
          unit: "bottles",
          unitPrice: 45.625,
        },
      ],
    });

    await storage.createCalculatorPreset({
      id: "PRESET-PG-1",
      name: "Proof Gallons (60gal @ 62.5% ABV)",
      calculationType: "proof_gallons",
      parameters: {
        volumeGallons: 60,
        abvPercent: 62.5,
      },
      notes: "Standard fill check for barrel entry.",
    });

    await storage.createCalculatorPreset({
      id: "PRESET-DIL-1",
      name: "Dilution Water (53gal 62.5% -> 47%)",
      calculationType: "dilution_water",
      parameters: {
        currentVolumeGallons: 53,
        currentAbvPercent: 62.5,
        targetAbvPercent: 47,
      },
      notes: "Common bottling dilution target.",
    });
  } catch (error) {
    console.error("Error seeding data:", error);
  }
}
