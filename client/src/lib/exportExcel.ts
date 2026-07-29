// Excel export for Distillr reports — branded for Lugo's Craft Distillery
// Uses exceljs (lazy-loaded) and file-saver

const GOLD  = "FFC9A227";
const DARK  = "FF2B1A0E";
const WHITE = "FFFFFFFF";
const GRAY  = "FFF7F7F7";
const MID   = "FFE8E0D4";
const TEXT  = "FF404040";

interface ExciseProductRow {
  key: string;
  name: string;
  abv: number;
  distCases: number;
  retailCases: number;
  totalCases: number;
  proofGallons: number;
  exciseTax: number;
  perBottle: number;
}

interface ExciseByProductReport {
  rows: ExciseProductRow[];
  totalDistCases: number;
  totalRetailCases: number;
  totalCases: number;
  totalProofGallons: number;
  totalExciseTax: number;
}

interface ReportExportData {
  month: string;
  proprietorName: string;
  dspNumber: string | null;
  exciseByProduct?: ExciseByProductReport;
  summary: {
    total_produced: number;
    prod_batch_count: number;
    total_deposited: number;
    beginning_bond_balance: number;
    period_losses_pg: number;
    ending_bond_balance: number;
    total_processed: number;
    total_excise_tax: number;
    total_cases_750: number;
    total_cases_1000: number;
    total_cases_1750: number;
    grand_total_cases: number;
  } | undefined;
  batches: Array<{
    batchCode: string;
    productName: string | null;
    spiritType: string | null;
    distillDate: string | null;
    fillDate: string | null;
    bottlingDate: string | null;
    proofGallonsProduced: number | null;
    fillProofGallons: number | null;
    proofGallonsProcessed: number | null;
    exciseTaxDue: number | null;
    totalCases: number | null;
    taxClass: string | null;
    lotNumber: string | null;
  }>;
  allBatches: Array<{
    batchCode: string;
    batchDate: string;
    stage: string;
    productName: string | null;
    spiritType: string | null;
    proofGallonsProduced: number | null;
    fillProofGallons: number | null;
    proofGallonsProcessed: number | null;
    totalCases: number | null;
    exciseTaxDue: number | null;
    taxClass: string | null;
  }>;
  barrels: Array<{
    serialNumber: string;
    productName: string | null;
    status: string;
    fillDate: string | null;
    fillProof: number | null;
    fillVolume: number | null;
    fillProofGallons: number | null;
    warehouseZone: string | null;
    charLevel: string | null;
  }>;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00Z");
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function taxClassLabel(tc: string | null): string {
  if (!tc) return "—";
  if (tc === "craft_tier1") return "Craft Tier 1 ($2.70/PG)";
  if (tc === "craft_tier2") return "Craft Tier 2 ($13.34/PG)";
  if (tc === "standard") return "Standard ($13.50/PG)";
  return tc;
}

export async function exportReportsToExcel(data: ReportExportData): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const { saveAs } = await import("file-saver");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Distillr";
  wb.lastModifiedBy = "Distillr";
  wb.created = new Date();

  // Load logo
  let logoId: number | undefined;
  try {
    const resp = await fetch("/lugo-logo.png");
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      logoId = wb.addImage({ buffer: buf, extension: "png" });
    }
  } catch {
    // logo not critical
  }

  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // ── Helper: add branded header to a sheet ────────────────────────────────
  function addHeader(
    ws: ExcelJS.Worksheet,
    title: string,
    subtitle: string,
  ) {
    // Row 1-5: reserved for logo + company block
    for (let r = 1; r <= 5; r++) {
      const row = ws.getRow(r);
      row.height = 18;
      ["A","B","C","D","E","F","G","H","I","J","K","L"].forEach((col) => {
        row.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      });
    }

    // Logo image (top-left, rows 1-4, col A)
    if (logoId !== undefined) {
      ws.addImage(logoId, {
        tl: { col: 0, row: 0 } as any,
        br: { col: 1, row: 4 } as any,
      });
    }

    // Company name — B1
    const r1 = ws.getRow(1);
    r1.height = 28;
    const nameCell = r1.getCell("B");
    nameCell.value = (data.proprietorName || "Lugo's Craft Distillery").toUpperCase();
    nameCell.font = { name: "Calibri", bold: true, size: 18, color: { argb: GOLD } };
    nameCell.alignment = { vertical: "middle" };

    // DSP — B2
    const r2 = ws.getRow(2);
    r2.getCell("B").value = data.dspNumber
      ? `DSP Permit: ${data.dspNumber}`
      : "DSP Permit: Not configured";
    r2.getCell("B").font = { name: "Calibri", size: 10, color: { argb: MID } };
    r2.getCell("B").alignment = { vertical: "middle" };

    // Report title — B3
    const r3 = ws.getRow(3);
    r3.getCell("B").value = title;
    r3.getCell("B").font = { name: "Calibri", bold: true, size: 13, color: { argb: WHITE } };
    r3.getCell("B").alignment = { vertical: "middle" };

    // Subtitle — B4
    const r4 = ws.getRow(4);
    r4.getCell("B").value = subtitle;
    r4.getCell("B").font = { name: "Calibri", size: 10, italic: true, color: { argb: MID } };
    r4.getCell("B").alignment = { vertical: "middle" };

    // Period + Generated — B5
    const r5 = ws.getRow(5);
    r5.getCell("B").value = `Reporting Period: ${data.month}   |   Generated: ${generatedAt}`;
    r5.getCell("B").font = { name: "Calibri", size: 9, color: { argb: MID } };
    r5.getCell("B").alignment = { vertical: "middle" };

    // Gold separator row
    const sep = ws.addRow([]);
    sep.height = 4;
    ["A","B","C","D","E","F","G","H","I","J","K","L"].forEach((col) => {
      sep.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    });

    // Blank spacer
    ws.addRow([]);
  }

  // ── Helper: styled table header row ─────────────────────────────────────
  function addTableHeader(ws: ExcelJS.Worksheet, cols: string[]) {
    const row = ws.addRow(cols);
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: GOLD } },
      };
    });
    row.height = 20;
    return row;
  }

  // ── Helper: totals row ───────────────────────────────────────────────────
  function addTotalsRow(ws: ExcelJS.Worksheet, values: (string | number | null)[]) {
    const row = ws.addRow(values);
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: DARK } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MID } };
      cell.border = {
        top: { style: "medium", color: { argb: GOLD } },
      };
    });
    return row;
  }

  // ── Helper: data cell style (alternating rows) ────────────────────────────
  function styleDataRow(row: ExcelJS.Row, idx: number) {
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 10, color: { argb: TEXT } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? WHITE : GRAY } };
    });
    row.height = 16;
  }

  // ── Helper: KV section ───────────────────────────────────────────────────
  function addKV(ws: ExcelJS.Worksheet, label: string, value: string, highlight = false) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { name: "Calibri", size: 10, color: { argb: "FF737373" }, italic: true };
    row.getCell(2).font = {
      name: "Calibri", bold: highlight, size: highlight ? 12 : 10,
      color: { argb: highlight ? GOLD : TEXT },
    };
    row.height = 18;
  }

  // =========================================================================
  // Sheet 1 — Operations (TTB 5110.40)
  // =========================================================================
  {
    const ws = wb.addWorksheet("Operations (5110.40)");
    ws.columns = [
      { key: "a", width: 14 },
      { key: "b", width: 36 },
      { key: "c", width: 20 },
      { key: "d", width: 20 },
    ];

    addHeader(ws, "Operations Report — TTB Form 5110.40", "Monthly Report of Production, Storage, and Processing Operations");

    const s = data.summary;
    addKV(ws, "PART I — Spirits Produced", "Proof Gallons by Distill Date");
    addKV(ws, "  Total Proof Gallons Produced", `${(s?.total_produced ?? 0).toFixed(2)} PG`, true);
    addKV(ws, "  Batches Distilled", String(s?.prod_batch_count ?? 0));
    ws.addRow([]);

    addKV(ws, "PART II — Deposited to Bond", "Fill Proof Gallons by Fill Date");
    addKV(ws, "  Total Fill Proof Gallons", `${(s?.total_deposited ?? 0).toFixed(2)} PG`, true);
    ws.addRow([]);

    addKV(ws, "PART III — Bonded Storage Balance", "Spirits in Bond at End of Period");
    addKV(ws, "  Beginning Inventory", `${(s?.beginning_bond_balance ?? 0).toFixed(2)} PG`);
    addKV(ws, "  + Spirits Deposited", `${(s?.total_deposited ?? 0).toFixed(2)} PG`);
    addKV(ws, "  − Spirits Processed", `${(s?.total_processed ?? 0).toFixed(2)} PG`);
    addKV(ws, "  − Losses (Angel's Share)", `${(s?.period_losses_pg ?? 0).toFixed(2)} PG`);
    addKV(ws, "  = Ending Bond Balance", `${(s?.ending_bond_balance ?? 0).toFixed(2)} PG`, true);
    ws.addRow([]);

    addKV(ws, "PART IV — Spirits Processed / Bottled", "Proof Gallons by Bottling Date");
    addKV(ws, "  Total Proof Gallons Processed", `${(s?.total_processed ?? 0).toFixed(2)} PG`, true);
    addKV(ws, "  Cases 750 mL", String(s?.total_cases_750 ?? 0));
    addKV(ws, "  Cases 1 L", String(s?.total_cases_1000 ?? 0));
    addKV(ws, "  Cases 1.75 L", String(s?.total_cases_1750 ?? 0));
    addKV(ws, "  Total Cases", String(s?.grand_total_cases ?? 0));
    ws.addRow([]);

    addKV(ws, "Total Excise Tax", `$${(s?.total_excise_tax ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, true);
  }

  // =========================================================================
  // Sheet 2 — Excise Tax (TTB 5000.24) — product-centric, matches spreadsheet
  // =========================================================================
  {
    const ws = wb.addWorksheet("Excise Tax (5000.24)");
    ws.columns = [
      { key: "a", width: 28 },  // Product
      { key: "b", width: 16 },  // Dist Cases
      { key: "c", width: 14 },  // Retail Cases
      { key: "d", width: 14 },  // Total Cases
      { key: "e", width: 10 },  // ABV
      { key: "f", width: 16 },  // Proof Gallons
      { key: "g", width: 16 },  // Excise Tax
      { key: "h", width: 14 },  // Per Bottle
    ];

    // Payment due = 14th of month following period end
    const [yr, mo] = data.month.split("-").map(Number);
    const dueDate = new Date(mo === 12 ? yr + 1 : yr, mo === 12 ? 0 : mo, 14);
    const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const periodLabel = data.month
      ? new Date(`${data.month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : data.month;

    addHeader(ws, "Excise Tax Return — TTB Form 5000.24", `Federal Excise Tax on Distilled Spirits · Due ${dueDateStr}`);

    // Filing info block
    const filingRow = ws.addRow(["Filing Information"]);
    filingRow.getCell(1).font = { name: "Calibri", bold: true, size: 11, color: { argb: DARK } };
    filingRow.height = 20;

    const fields: [string, string][] = [
      ["Proprietor", data.proprietorName],
      ["DSP Permit Number", data.dspNumber ?? "Not configured"],
      ["Tax Period", periodLabel],
      ["Payment Due", dueDateStr],
      ["Payment Method", "Electronic Funds Transfer (EFT) via Pay.gov"],
    ];
    for (const [label, value] of fields) {
      const r = ws.addRow([label, value]);
      r.getCell(1).font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF737373" } };
      r.getCell(2).font = { name: "Calibri", size: 10, bold: true, color: { argb: DARK } };
      r.height = 16;
    }
    ws.addRow([]);

    // Section header
    const schedHeader = ws.addRow(["Schedule A — Excise Tax by Product"]);
    schedHeader.getCell(1).font = { name: "Calibri", bold: true, size: 11, color: { argb: DARK } };
    schedHeader.height = 20;

    // Table header
    addTableHeader(ws, [
      "Product", "Distributor Cases", "Retail Cases", "Total Cases",
      "ABV %", "Proof Gallons", "Excise Tax", "Per Bottle",
    ]);

    const ebp = data.exciseByProduct;
    let idx = 0;

    if (!ebp || ebp.rows.length === 0) {
      const r = ws.addRow(["No product excise data for this period.", "", "", "", "", "", "", ""]);
      r.getCell(1).font = { name: "Calibri", italic: true, color: { argb: "FF737373" } };
    } else {
      for (const row of ebp.rows) {
        const active = row.totalCases > 0;
        const r = ws.addRow([
          row.name,
          active ? row.distCases   : "—",
          active ? row.retailCases : "—",
          active ? row.totalCases  : "—",
          `${row.abv.toFixed(1)}%`,
          active ? row.proofGallons.toFixed(4) : "—",
          active ? `$${row.exciseTax.toFixed(2)}` : "—",
          active ? `$${row.perBottle.toFixed(4)}` : "—",
        ]);
        // Dim zero rows
        r.eachCell((cell) => {
          cell.font = {
            name: "Calibri", size: 10,
            color: { argb: active ? TEXT : "FFC0C0C0" },
          };
          cell.fill = {
            type: "pattern", pattern: "solid",
            fgColor: { argb: active ? (idx % 2 === 0 ? WHITE : GRAY) : WHITE },
          };
        });
        if (active) {
          // Gold excise tax cell
          r.getCell(7).font = { name: "Calibri", bold: true, size: 10, color: { argb: GOLD } };
        }
        r.height = 16;
        if (active) idx++;
      }

      // Totals
      const tot = addTotalsRow(ws, [
        "TOTALS",
        ebp.totalDistCases,
        ebp.totalRetailCases,
        ebp.totalCases,
        "",
        ebp.totalProofGallons.toFixed(4),
        `$${ebp.totalExciseTax.toFixed(2)}`,
        "",
      ]);
      tot.getCell(7).font = { name: "Calibri", bold: true, size: 11, color: { argb: GOLD } };
    }

    // Formula footnote
    ws.addRow([]);
    const fnRow = ws.addRow([
      "Formula: Cases × 1.19 gal/case × (ABV × 2) ÷ 100 = Proof Gallons   ·   Rate: $2.70/PG (Craft Tier 1, IRC §5001(c)(1))",
    ]);
    fnRow.getCell(1).font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF999999" } };

    // Payment summary
    ws.addRow([]);
    const psHeader = ws.addRow(["Payment Summary"]);
    psHeader.getCell(1).font = { name: "Calibri", bold: true, size: 11, color: { argb: DARK } };
    psHeader.height = 20;

    const netTax = ebp?.totalExciseTax ?? 0;
    const psRows: [string, string][] = [
      ["Total Tax Determined (Schedule A)", `$${netTax.toFixed(2)}`],
      ["Credits / Prior Overpayments", "$0.00"],
      ["Net Tax Due", `$${netTax.toFixed(2)}`],
    ];
    for (const [label, value] of psRows) {
      const r = ws.addRow([label, value]);
      const isNet = label.startsWith("Net");
      r.getCell(1).font = { name: "Calibri", size: 10, italic: !isNet, color: { argb: isNet ? DARK : "FF737373" } };
      r.getCell(2).font = { name: "Calibri", bold: isNet, size: isNet ? 12 : 10, color: { argb: isNet ? GOLD : TEXT } };
      r.height = isNet ? 20 : 16;
    }
  }

  // =========================================================================
  // Sheet 3 — Batch Detail (period)
  // =========================================================================
  {
    const ws = wb.addWorksheet("Batch Detail");
    ws.columns = [
      { key: "a", width: 18 },
      { key: "b", width: 22 },
      { key: "c", width: 14 },
      { key: "d", width: 14 },
      { key: "e", width: 14 },
      { key: "f", width: 14 },
      { key: "g", width: 14 },
      { key: "h", width: 14 },
      { key: "i", width: 10 },
      { key: "j", width: 16 },
      { key: "k", width: 22 },
      { key: "l", width: 14 },
    ];

    addHeader(ws, `Batch Detail — ${data.month}`, "Batches with distill, fill, or bottling date in the reporting period");

    addTableHeader(ws, [
      "Batch Code", "Product", "Spirit", "Distill Date", "Fill Date", "Bottling Date",
      "PG Produced", "PG Deposited", "PG Processed", "Cases", "Excise Tax", "Tax Class",
    ]);

    let idx = 0;
    let totProd = 0, totDep = 0, totProc = 0, totCases = 0, totTax = 0;
    for (const b of data.batches) {
      const row = ws.addRow([
        b.batchCode,
        b.productName ?? "—",
        b.spiritType ?? "—",
        fmtDate(b.distillDate),
        fmtDate(b.fillDate),
        fmtDate(b.bottlingDate),
        b.proofGallonsProduced != null ? b.proofGallonsProduced.toFixed(2) : "—",
        b.fillProofGallons != null ? b.fillProofGallons.toFixed(2) : "—",
        b.proofGallonsProcessed != null ? b.proofGallonsProcessed.toFixed(2) : "—",
        b.totalCases ?? "—",
        b.exciseTaxDue != null ? `$${b.exciseTaxDue.toFixed(2)}` : "—",
        taxClassLabel(b.taxClass),
      ]);
      styleDataRow(row, idx++);
      totProd += b.proofGallonsProduced ?? 0;
      totDep  += b.fillProofGallons ?? 0;
      totProc += b.proofGallonsProcessed ?? 0;
      totCases += b.totalCases ?? 0;
      totTax  += b.exciseTaxDue ?? 0;
    }
    addTotalsRow(ws, [
      `Totals (${data.batches.length})`, "", "", "", "", "",
      totProd.toFixed(2), totDep.toFixed(2), totProc.toFixed(2),
      totCases, `$${totTax.toFixed(2)}`, "",
    ]);
  }

  // =========================================================================
  // Sheet 4 — All Production
  // =========================================================================
  {
    const ws = wb.addWorksheet("All Production");
    ws.columns = [
      { key: "a", width: 18 },
      { key: "b", width: 22 },
      { key: "c", width: 14 },
      { key: "d", width: 14 },
      { key: "e", width: 22 },
      { key: "f", width: 14 },
      { key: "g", width: 14 },
      { key: "h", width: 14 },
      { key: "i", width: 10 },
      { key: "j", width: 16 },
    ];

    addHeader(ws, "All Production Batches", "Complete batch history — all time");

    addTableHeader(ws, [
      "Batch Code", "Product", "Spirit", "Batch Date", "Stage",
      "PG Produced", "PG Deposited", "PG Processed", "Cases", "Excise Tax",
    ]);

    const STAGE_LABELS: Record<string, string> = {
      planning: "Planning", mash_fermentation: "Mash & Fermentation",
      distillation: "Distillation", barreling: "Barreling",
      aging: "Aging", bottling: "Bottling", closed: "Closed",
    };

    let idx = 0;
    let totProd = 0, totDep = 0, totProc = 0, totCases = 0, totTax = 0;
    for (const b of data.allBatches) {
      const row = ws.addRow([
        (b as any).batchCode,
        (b as any).productName ?? "—",
        (b as any).spiritType ?? "—",
        fmtDate((b as any).batchDate),
        STAGE_LABELS[(b as any).stage] ?? (b as any).stage,
        (b as any).proofGallonsProduced != null ? Number((b as any).proofGallonsProduced).toFixed(2) : "—",
        (b as any).fillProofGallons != null ? Number((b as any).fillProofGallons).toFixed(2) : "—",
        (b as any).proofGallonsProcessed != null ? Number((b as any).proofGallonsProcessed).toFixed(2) : "—",
        (b as any).totalCases ?? "—",
        (b as any).exciseTaxDue != null ? `$${Number((b as any).exciseTaxDue).toFixed(2)}` : "—",
      ]);
      styleDataRow(row, idx++);
      totProd  += Number((b as any).proofGallonsProduced) || 0;
      totDep   += Number((b as any).fillProofGallons) || 0;
      totProc  += Number((b as any).proofGallonsProcessed) || 0;
      totCases += Number((b as any).totalCases) || 0;
      totTax   += Number((b as any).exciseTaxDue) || 0;
    }
    addTotalsRow(ws, [
      `Totals (${data.allBatches.length})`, "", "", "", "",
      totProd.toFixed(2), totDep.toFixed(2), totProc.toFixed(2),
      totCases, `$${totTax.toFixed(2)}`,
    ]);
  }

  // =========================================================================
  // Sheet 5 — Barrel Inventory
  // =========================================================================
  {
    const ws = wb.addWorksheet("Barrel Inventory");
    ws.columns = [
      { key: "a", width: 18 },
      { key: "b", width: 22 },
      { key: "c", width: 12 },
      { key: "d", width: 14 },
      { key: "e", width: 10 },
      { key: "f", width: 12 },
      { key: "g", width: 14 },
      { key: "h", width: 20 },
      { key: "i", width: 10 },
    ];

    addHeader(ws, "Barrel Inventory", "All barrels tracked in the bonded warehouse");

    addTableHeader(ws, [
      "Serial #", "Product", "Status", "Fill Date",
      "Proof", "Wine Gal", "Proof Gal", "Zone / Rack", "Char Level",
    ]);

    let idx = 0;
    let totWg = 0, totPg = 0;
    for (const b of data.barrels) {
      const row = ws.addRow([
        b.serialNumber,
        b.productName ?? "—",
        b.status,
        fmtDate(b.fillDate),
        b.fillProof != null ? `${b.fillProof}°` : "—",
        b.fillVolume != null ? Number(b.fillVolume).toFixed(2) : "—",
        b.fillProofGallons != null ? Number(b.fillProofGallons).toFixed(2) : "—",
        b.warehouseZone ?? "—",
        b.charLevel ?? "—",
      ]);
      styleDataRow(row, idx++);
      totWg += b.fillVolume ?? 0;
      totPg += b.fillProofGallons ?? 0;
    }
    addTotalsRow(ws, [
      `Totals (${data.barrels.length})`, "", "", "", "",
      totWg.toFixed(2), totPg.toFixed(2), "", "",
    ]);
  }

  // =========================================================================
  // Save
  // =========================================================================
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${data.proprietorName.replace(/\s+/g, "_")}_Reports_${data.month}.xlsx`);
}
