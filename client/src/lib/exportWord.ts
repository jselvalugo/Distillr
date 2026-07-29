// Word document generation for official TTB forms
// Strict black-and-white, Times New Roman, standard government formatting

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WordOperationsData {
  month: string;
  proprietorName: string;
  dspNumber: string | null;
  address?: string | null;
  summary: {
    total_produced: number;
    prod_batch_count: number;
    total_deposited: number;
    total_fill_wine_gallons: number;
    beginning_bond_balance: number;
    period_losses_pg: number;
    ending_bond_balance: number;
    total_processed: number;
    total_excise_tax: number;
    total_cases_750: number;
    total_cases_1000: number;
    total_cases_1750: number;
    grand_total_cases: number;
    barrels_in_bond_count: number;
    barrels_in_bond_wg: number;
    barrels_in_bond_pg: number;
    produced_by_spirit?: Array<{
      spiritType: string; spiritClass: string;
      batchCount: number; proofGallons: number; batchCodes: string[];
    }>;
    deposited_by_spirit?: Array<{
      spiritType: string; spiritClass: string;
      barrelCount: number; wineGallons: number; proofGallons: number;
      avgFillProof: number; fillNumbers: string;
    }>;
    processed_by_spirit?: Array<{
      spiritType: string; spiritClass: string;
      batchCount: number; proofGallons: number; avgBottlingProof: number;
      cases750: number; cases1000: number; cases1750: number;
      totalCases: number; exciseTaxDue: number; lotNumbers: string[];
    }>;
  } | undefined;
}

export interface WordExciseData {
  month: string;
  proprietorName: string;
  dspNumber: string | null;
  ein?: string | null;
  address?: string | null;
  exciseByProduct?: {
    rows: Array<{
      key: string; name: string; abv: number;
      distCases: number; retailCases: number; totalCases: number;
      proofGallons: number; exciseTax: number; perBottle: number;
    }>;
    totalDistCases: number; totalRetailCases: number;
    totalCases: number; totalProofGallons: number; totalExciseTax: number;
  };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function periodLabel(month: string): string {
  if (!month) return "—";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function periodRange(month: string): { start: string; end: string } {
  if (!month) return { start: "—", end: "—" };
  const [yr, mo] = month.split("-").map(Number);
  const start = new Date(yr, mo - 1, 1).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const end   = new Date(yr, mo, 0).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  return { start, end };
}

function dueDate(month: string): string {
  if (!month) return "—";
  const [yr, mo] = month.split("-").map(Number);
  const d = new Date(mo === 12 ? yr + 1 : yr, mo === 12 ? 0 : mo, 14);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function pg(n: number | undefined | null): string { return (n ?? 0).toFixed(2); }
function money(n: number | undefined | null): string {
  return `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ─── TTB 5110.40 ─────────────────────────────────────────────────────────────

export async function export5110Word(data: WordOperationsData): Promise<void> {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, BorderStyle, WidthType,
    ShadingType, VerticalAlign, PageBreak, TableLayoutType,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const s = data.summary;
  const { start, end } = periodRange(data.month);

  // ── B&W palette ─────────────────────────────────────────────────────────────
  const FONT   = "Times New Roman";
  const BLACK  = "000000";
  const WHITE  = "FFFFFF";
  const LGRAY  = "F2F2F2"; // alternating row
  const HGRAY  = "D9D9D9"; // column headers
  const BGRAY  = "AAAAAA"; // section banner fill
  const NONE   = { style: BorderStyle.NONE, size: 0, color: WHITE } as const;
  const THIN   = { style: BorderStyle.SINGLE, size: 4,  color: BLACK } as const;
  const THICK  = { style: BorderStyle.SINGLE, size: 12, color: BLACK } as const;
  const DBL    = { style: BorderStyle.DOUBLE, size: 6,  color: BLACK } as const;
  const W      = 9360; // full page width in DXA (0.75" margins on 8.5" page)

  function fixedTable(opts: ConstructorParameters<typeof Table>[0]): Table {
    return new Table({ layout: TableLayoutType.FIXED, ...opts });
  }

  // ── Small builders ───────────────────────────────────────────────────────────

  function r(text: string, bold = false, size = 20, italic = false, color = BLACK): TextRun {
    return new TextRun({ text, font: FONT, bold, size, italics: italic, color });
  }
  function sp(after = 120): Paragraph { return new Paragraph({ children: [], spacing: { after } }); }

  function center(text: string, bold = false, size = 20): Paragraph {
    return new Paragraph({ children: [r(text, bold, size)], alignment: AlignmentType.CENTER, spacing: { after: 40 } });
  }

  function sectionBar(text: string): Table {
    return fixedTable({
      width: { size: W, type: WidthType.DXA },
      rows: [new TableRow({ children: [new TableCell({
        columnSpan: 1,
        shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
        borders: { top: THICK, bottom: THICK, left: THICK, right: THICK },
        children: [new Paragraph({ children: [r(text, true, 20)], spacing: { before: 80, after: 80 }, indent: { left: 120 } })],
      })] })],
    });
  }

  function colHeader(text: string, width: number, align = AlignmentType.CENTER): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
      borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [r(text, true, 17)], alignment: align, spacing: { before: 50, after: 50 } })],
    });
  }

  function cell(text: string, width: number, align = AlignmentType.LEFT, bold = false, shade = false): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
      shading: shade ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined,
      children: [new Paragraph({
        children: [r(text || "—", bold, 18)],
        alignment: align,
        spacing: { before: 40, after: 40 },
        indent: align === AlignmentType.LEFT ? { left: 80 } : undefined,
      })],
    });
  }

  function totalCell(text: string, width: number, align = AlignmentType.LEFT): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: { top: DBL, bottom: THIN, left: THIN, right: THIN },
      shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
      children: [new Paragraph({
        children: [r(text, true, 19)],
        alignment: align,
        spacing: { before: 50, after: 50 },
        indent: align === AlignmentType.LEFT ? { left: 80 } : undefined,
      })],
    });
  }

  // ── Document children ────────────────────────────────────────────────────────

  const doc_children: any[] = [];

  // Header
  doc_children.push(
    new Paragraph({ children: [r("OMB No. 1513-0003", false, 16, true, "555555")], alignment: AlignmentType.RIGHT, spacing: { after: 20 } }),
    center("DEPARTMENT OF THE TREASURY", true, 20),
    center("Alcohol and Tobacco Tax and Trade Bureau (TTB)", false, 18),
    new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLACK } }, spacing: { after: 60 } }),
    center("DISTILLED SPIRITS PLANT", true, 26),
    center("MONTHLY REPORT OF PRODUCTION OPERATIONS", true, 22),
    center("TTB Form 5110.40  (Rev. 10/2023)", false, 17),
    sp(80),
  );

  // ── PART I — Identification ──────────────────────────────────────────────────
  doc_children.push(sectionBar("PART I — IDENTIFICATION AND FILING INFORMATION"), sp(0));

  const idRows: [string, string][] = [
    ["Name of Proprietor:",   data.proprietorName],
    ["DSP Permit Number:",    data.dspNumber ?? "Not configured"],
    ["Address:",              data.address ?? ""],
    ["Reporting Period:",     periodLabel(data.month)],
    ["Period Beginning:",     start],
    ["Period Ending:",        end],
  ];
  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: idRows.map(([lbl, val], i) => new TableRow({ children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r(lbl, true, 17)], spacing: { before: 50, after: 50 }, indent: { left: 80 } })] }),
      new TableCell({ width: { size: 6760, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r(val || " ", false, 17)], spacing: { before: 50, after: 50 }, indent: { left: 80 } })] }),
    ] })),
  }), sp(120));

  // ── PART II — Spirits Produced ───────────────────────────────────────────────
  doc_children.push(sectionBar("PART II — SPIRITS PRODUCED  (By distillation date within the reporting period)"), sp(0));

  // Part II column widths: 2000+1400+800+3760+1400 = 9360
  const P2 = [2000, 1400, 800, 3760, 1400];
  const prodRows = (s?.produced_by_spirit ?? []).map((r2, i) => new TableRow({ children: [
    cell(cap(r2.spiritType), P2[0], AlignmentType.LEFT, false, i % 2 === 1),
    cell(cap(r2.spiritClass) || "—", P2[1], AlignmentType.LEFT, false, i % 2 === 1),
    cell(String(r2.batchCount), P2[2], AlignmentType.CENTER, false, i % 2 === 1),
    cell((r2.batchCodes ?? []).join(", ") || "—", P2[3], AlignmentType.LEFT, false, i % 2 === 1),
    cell(pg(r2.proofGallons), P2[4], AlignmentType.RIGHT, false, i % 2 === 1),
  ] }));
  if (prodRows.length === 0) prodRows.push(new TableRow({ children: [cell("No spirits produced in this period.", P2[0]+P2[1]+P2[2]+P2[3], AlignmentType.LEFT), cell("—", P2[4], AlignmentType.RIGHT)] }));

  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [colHeader("Spirit Type / Kind", P2[0]), colHeader("Class", P2[1]), colHeader("Batches", P2[2]), colHeader("Batch Codes", P2[3]), colHeader("Proof Gallons", P2[4], AlignmentType.RIGHT)] }),
      ...prodRows,
      new TableRow({ children: [totalCell(`TOTAL  (${s?.prod_batch_count ?? 0} batches)`, P2[0]+P2[1]+P2[2]+P2[3], AlignmentType.LEFT), totalCell(pg(s?.total_produced), P2[4], AlignmentType.RIGHT)] }),
    ],
  }), sp(120));

  // ── PART III — Spirits Deposited to Bond ────────────────────────────────────
  doc_children.push(sectionBar("PART III — SPIRITS DEPOSITED TO BOND  (By fill/barrel date within the reporting period)"), sp(0));

  // Part III column widths: 1500+1100+2460+700+1000+800+1800 = 9360
  const P3 = [1500, 1100, 2460, 700, 1000, 800, 1800];
  const depRows = (s?.deposited_by_spirit ?? []).map((r2, i) => new TableRow({ children: [
    cell(cap(r2.spiritType), P3[0], AlignmentType.LEFT, false, i % 2 === 1),
    cell(cap(r2.spiritClass) || "—", P3[1], AlignmentType.LEFT, false, i % 2 === 1),
    cell(r2.fillNumbers || "—", P3[2], AlignmentType.LEFT, false, i % 2 === 1),
    cell(String(r2.barrelCount), P3[3], AlignmentType.CENTER, false, i % 2 === 1),
    cell(pg(r2.wineGallons), P3[4], AlignmentType.RIGHT, false, i % 2 === 1),
    cell(`${(r2.avgFillProof ?? 0).toFixed(1)}°`, P3[5], AlignmentType.RIGHT, false, i % 2 === 1),
    cell(pg(r2.proofGallons), P3[6], AlignmentType.RIGHT, false, i % 2 === 1),
  ] }));
  if (depRows.length === 0) depRows.push(new TableRow({ children: [cell("No spirits deposited in this period.", W, AlignmentType.LEFT)] }));

  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [colHeader("Spirit Type", P3[0]), colHeader("Class", P3[1]), colHeader("Fill / Barrel Numbers", P3[2]), colHeader("Barrels", P3[3]), colHeader("Wine Gal.", P3[4], AlignmentType.RIGHT), colHeader("Avg Proof", P3[5], AlignmentType.RIGHT), colHeader("Proof Gallons", P3[6], AlignmentType.RIGHT)] }),
      ...depRows,
      new TableRow({ children: [totalCell("TOTAL", P3[0]+P3[1]+P3[2], AlignmentType.LEFT), totalCell(String(s?.deposited_by_spirit?.reduce((a, r2) => a + r2.barrelCount, 0) ?? 0), P3[3], AlignmentType.CENTER), totalCell(pg(s?.total_fill_wine_gallons), P3[4], AlignmentType.RIGHT), totalCell("", P3[5], AlignmentType.RIGHT), totalCell(pg(s?.total_deposited), P3[6], AlignmentType.RIGHT)] }),
    ],
  }), sp(120));

  // ── PART IV — Bonded Storage Balance ────────────────────────────────────────
  doc_children.push(sectionBar("PART IV — BONDED STORAGE BALANCE  (Proof gallons on hand)"), sp(0));

  const ledger: [string, string, boolean][] = [
    ["1.   On hand at beginning of this report period",                    pg(s?.beginning_bond_balance), false],
    ["2.   Spirits deposited to bond during this period (Part III)",       pg(s?.total_deposited),        false],
    ["3.   Spirits removed from bond / processed (Part V)",                `(${pg(s?.total_processed)})`, false],
    ["4.   Losses (evaporation, spillage, Angel's Share)",                 `(${pg(s?.period_losses_pg)})`,false],
    ["5.   ON HAND AT END OF PERIOD  (Lines 1 + 2 − 3 − 4)",             pg(s?.ending_bond_balance),    true ],
  ];

  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [colHeader("Description", 7360, AlignmentType.LEFT), colHeader("Proof Gallons", 2000, AlignmentType.RIGHT)] }),
      ...ledger.map(([desc, val, isTotal]) => new TableRow({ children: [
        new TableCell({ width: { size: 7360, type: WidthType.DXA }, borders: { top: isTotal ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, shading: isTotal ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(desc, isTotal, 18)], spacing: { before: 60, after: 60 }, indent: { left: 120 } })] }),
        new TableCell({ width: { size: 2000, type: WidthType.DXA }, borders: { top: isTotal ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, shading: isTotal ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(val, isTotal, isTotal ? 20 : 18)], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
      ] })),
    ],
  }));

  doc_children.push(
    sp(40),
    new Paragraph({
      children: [
        r("Warehouse Snapshot (as of report generation date):  ", true, 17),
        r(`${s?.barrels_in_bond_count ?? 0} barrel(s) aging  ·  ${pg(s?.barrels_in_bond_wg)} wine gallons  ·  ${pg(s?.barrels_in_bond_pg)} proof gallons in bond`, false, 17),
      ],
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: BLACK } },
      indent: { left: 160, right: 120 },
      spacing: { before: 60, after: 120 },
    }),
  );

  // ── PART V — Spirits Processed / Bottled ────────────────────────────────────
  doc_children.push(sectionBar("PART V — SPIRITS PROCESSED / BOTTLED  (By bottling date — taxable removals from bond)"), sp(0));

  // Part V column widths: 1200+900+1700+700+700+650+700+700+900+1210 = 9360
  const P5 = [1200, 900, 1700, 700, 700, 650, 700, 700, 900, 1210];
  const procRows = (s?.processed_by_spirit ?? []).map((r2, i) => new TableRow({ children: [
    cell(cap(r2.spiritType), P5[0], AlignmentType.LEFT, false, i % 2 === 1),
    cell(cap(r2.spiritClass) || "—", P5[1], AlignmentType.LEFT, false, i % 2 === 1),
    cell((r2.lotNumbers ?? []).join(", ") || "—", P5[2], AlignmentType.LEFT, false, i % 2 === 1),
    cell(`${(r2.avgBottlingProof ?? 0).toFixed(1)}°`, P5[3], AlignmentType.RIGHT, false, i % 2 === 1),
    cell(String(r2.cases750 || "—"), P5[4], AlignmentType.RIGHT, false, i % 2 === 1),
    cell(String(r2.cases1000 || "—"), P5[5], AlignmentType.RIGHT, false, i % 2 === 1),
    cell(String(r2.cases1750 || "—"), P5[6], AlignmentType.RIGHT, false, i % 2 === 1),
    cell(String(r2.totalCases), P5[7], AlignmentType.RIGHT, false, i % 2 === 1),
    cell(pg(r2.proofGallons), P5[8], AlignmentType.RIGHT, false, i % 2 === 1),
    cell(money(r2.exciseTaxDue), P5[9], AlignmentType.RIGHT, false, i % 2 === 1),
  ] }));
  if (procRows.length === 0) procRows.push(new TableRow({ children: [cell("No spirits processed in this period.", W, AlignmentType.LEFT)] }));

  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [colHeader("Spirit Type", P5[0]), colHeader("Class", P5[1]), colHeader("Lot Numbers", P5[2]), colHeader("Proof", P5[3], AlignmentType.RIGHT), colHeader("750mL cs", P5[4], AlignmentType.RIGHT), colHeader("1 L cs", P5[5], AlignmentType.RIGHT), colHeader("1.75L cs", P5[6], AlignmentType.RIGHT), colHeader("Total cs", P5[7], AlignmentType.RIGHT), colHeader("PG Removed", P5[8], AlignmentType.RIGHT), colHeader("Excise Tax", P5[9], AlignmentType.RIGHT)] }),
      ...procRows,
      new TableRow({ children: [
        totalCell("TOTAL PROCESSED", P5[0]+P5[1]+P5[2], AlignmentType.LEFT),
        totalCell("", P5[3], AlignmentType.RIGHT),
        totalCell(String(s?.total_cases_750 ?? 0), P5[4], AlignmentType.RIGHT),
        totalCell(String(s?.total_cases_1000 ?? 0), P5[5], AlignmentType.RIGHT),
        totalCell(String(s?.total_cases_1750 ?? 0), P5[6], AlignmentType.RIGHT),
        totalCell(String(s?.grand_total_cases ?? 0), P5[7], AlignmentType.RIGHT),
        totalCell(pg(s?.total_processed), P5[8], AlignmentType.RIGHT),
        totalCell(money(s?.total_excise_tax), P5[9], AlignmentType.RIGHT),
      ] }),
    ],
  }), sp(180));

  // ── Certification ────────────────────────────────────────────────────────────
  doc_children.push(
    new Paragraph({ children: [r("CERTIFICATION", true, 20)], spacing: { before: 0, after: 60 } }),
    new Paragraph({
      children: [r("Under penalties of perjury, I declare that I have examined this report, including accompanying schedules and statements, and to the best of my knowledge and belief it is true, correct, and complete.", false, 17, true)],
      border: { left: { style: BorderStyle.SINGLE, size: 8, color: BLACK } },
      indent: { left: 120, right: 120 },
      spacing: { before: 40, after: 120 },
    }),
    fixedTable({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [
          new TableCell({ width: { size: 5200, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r("Signature of Proprietor or Authorized Agent", false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
          new TableCell({ width: { size: 400, type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [sp(0)] }),
          new TableCell({ width: { size: 3760, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r("Date", false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
        ] }),
        new TableRow({ children: [
          new TableCell({ width: { size: 5200, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r("Printed Name and Title", false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
          new TableCell({ width: { size: 400, type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [sp(0)] }),
          new TableCell({ width: { size: 3760, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r(`DSP Permit No.:  ${data.dspNumber ?? "_______________________"}`, false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
        ] }),
      ],
    }),
    sp(80),
    new Paragraph({
      children: [r(`TTB Form 5110.40  ·  ${periodLabel(data.month)}  ·  ${data.proprietorName}  ·  Generated by Distillr ERP`, false, 15, true, "888888")],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
      spacing: { before: 60 },
    }),
  );

  const doc = new Document({
    creator: "Distillr ERP",
    title: `TTB 5110.40 — ${data.proprietorName} — ${periodLabel(data.month)}`,
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: doc_children }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `TTB_5110_40_${data.proprietorName.replace(/\s+/g, "_")}_${data.month}.docx`);
}

// ─── TTB 5000.24 — Excise Tax Return ─────────────────────────────────────────

export async function export5000Word(data: WordExciseData): Promise<void> {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, BorderStyle, WidthType,
    ShadingType, VerticalAlign, PageBreak,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const ebp = data.exciseByProduct;
  const { start, end } = periodRange(data.month);
  const due = dueDate(data.month);
  const totalPG  = ebp?.totalProofGallons ?? 0;
  const totalTax = ebp?.totalExciseTax    ?? 0;

  // ── B&W palette ─────────────────────────────────────────────────────────────
  const FONT  = "Times New Roman";
  const BLACK = "000000";
  const WHITE = "FFFFFF";
  const LGRAY = "F2F2F2";
  const HGRAY = "D9D9D9";
  const NONE  = { style: BorderStyle.NONE,   size: 0,  color: WHITE } as const;
  const THIN  = { style: BorderStyle.SINGLE, size: 4,  color: BLACK } as const;
  const THICK = { style: BorderStyle.SINGLE, size: 12, color: BLACK } as const;
  const DBL   = { style: BorderStyle.DOUBLE, size: 6,  color: BLACK } as const;
  const W     = 9360;

  function fixedTable2(opts: ConstructorParameters<typeof Table>[0]): Table {
    return new Table({ layout: TableLayoutType.FIXED, ...opts });
  }

  // ── Builders ─────────────────────────────────────────────────────────────────

  function r(text: string, bold = false, size = 20, italic = false, color = BLACK): TextRun {
    return new TextRun({ text, font: FONT, bold, size, italics: italic, color });
  }
  function sp(after = 120): Paragraph { return new Paragraph({ children: [], spacing: { after } }); }
  function center(text: string, bold = false, size = 20): Paragraph {
    return new Paragraph({ children: [r(text, bold, size)], alignment: AlignmentType.CENTER, spacing: { after: 40 } });
  }

  // Section banner: gray filled full-width row
  function sectionBar(text: string): Table {
    return fixedTable2({
      width: { size: W, type: WidthType.DXA },
      rows: [new TableRow({ children: [new TableCell({
        shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
        borders: { top: THICK, bottom: THICK, left: THICK, right: THICK },
        children: [new Paragraph({ children: [r(text, true, 20)], spacing: { before: 80, after: 80 }, indent: { left: 120 } })],
      })] })],
    });
  }

  // Labeled field: two-column row (label | value)
  function fieldRow(label: string, value: string, labelW = 3200): TableRow {
    return new TableRow({ children: [
      new TableCell({ width: { size: labelW, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r(label, true, 17)], spacing: { before: 50, after: 50 }, indent: { left: 80 } })] }),
      new TableCell({ width: { size: W - labelW, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r(value || " ", false, 17)], spacing: { before: 50, after: 50 }, indent: { left: 80 } })] }),
    ] });
  }

  // Summary line: description + amount
  function summaryRow(lineNum: string, desc: string, amount: string, isTotal = false): TableRow {
    return new TableRow({ children: [
      new TableCell({ width: { size: 800, type: WidthType.DXA }, borders: { top: isTotal ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, shading: isTotal ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(lineNum, isTotal, 17)], alignment: AlignmentType.CENTER, spacing: { before: 55, after: 55 } })] }),
      new TableCell({ width: { size: 6760, type: WidthType.DXA }, borders: { top: isTotal ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, shading: isTotal ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(desc, isTotal, 18)], spacing: { before: 55, after: 55 }, indent: { left: 120 } })] }),
      new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders: { top: isTotal ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, shading: isTotal ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(amount, isTotal, isTotal ? 20 : 18)], alignment: AlignmentType.RIGHT, spacing: { before: 55, after: 55 } })] }),
    ] });
  }

  // ── Document ─────────────────────────────────────────────────────────────────

  const children: any[] = [];

  // ── Letterhead ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [r("OMB No. 1513-0083  ·  Expires: See current form", false, 16, true, "555555")], alignment: AlignmentType.RIGHT, spacing: { after: 20 } }),
    center("DEPARTMENT OF THE TREASURY", true, 20),
    center("Alcohol and Tobacco Tax and Trade Bureau (TTB)", false, 18),
    new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLACK } }, spacing: { after: 60 } }),
    center("EXCISE TAX RETURN", true, 28),
    center("TTB Form 5000.24  (Rev. 10/2021)  ·  Distilled Spirits", false, 17),
    sp(80),
  );

  // ── PART I — Identification ───────────────────────────────────────────────────
  children.push(sectionBar("PART I — IDENTIFICATION AND FILING INFORMATION"), sp(0));

  // Two-column identification grid
  children.push(fixedTable2({
    width: { size: W, type: WidthType.DXA },
    rows: [
      // Row 1: Serial No | Amount of Payment
      new TableRow({ children: [
        new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
          new Paragraph({ children: [r("1a.  Serial Number / Reference", false, 15, true, "555555")], spacing: { before: 30 }, indent: { left: 80 } }),
          new Paragraph({ children: [r(`${data.dspNumber ?? "N/A"}-${data.month}`, true, 18)], spacing: { after: 50 }, indent: { left: 80 } }),
        ] }),
        new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
          new Paragraph({ children: [r("1b.  Amount of Tax Payment", false, 15, true, "555555")], spacing: { before: 30 }, indent: { left: 80 } }),
          new Paragraph({ children: [r(money(totalTax), true, 18)], spacing: { after: 50 }, indent: { left: 80 } }),
        ] }),
      ] }),
      // Row 2: Form of Payment | Return Covers
      new TableRow({ children: [
        new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
          new Paragraph({ children: [r("1c.  Form of Payment", false, 15, true, "555555")], spacing: { before: 30 }, indent: { left: 80 } }),
          new Paragraph({ children: [r("☑  Electronic Funds Transfer (EFT) via Pay.gov", false, 18)], spacing: { after: 50 }, indent: { left: 80 } }),
        ] }),
        new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
          new Paragraph({ children: [r("1d.  Return Covers Period", false, 15, true, "555555")], spacing: { before: 30 }, indent: { left: 80 } }),
          new Paragraph({ children: [r(`${start}  through  ${end}`, false, 18)], spacing: { after: 50 }, indent: { left: 80 } }),
        ] }),
      ] }),
      // Row 3: Due Date | EIN
      new TableRow({ children: [
        new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
          new Paragraph({ children: [r("1e.  Date Payment Due", false, 15, true, "555555")], spacing: { before: 30 }, indent: { left: 80 } }),
          new Paragraph({ children: [r(due, false, 18)], spacing: { after: 50 }, indent: { left: 80 } }),
        ] }),
        new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
          new Paragraph({ children: [r("1f.  Employer Identification Number (EIN)", false, 15, true, "555555")], spacing: { before: 30 }, indent: { left: 80 } }),
          new Paragraph({ children: [r(data.ein ?? "________________________________", false, 18)], spacing: { after: 50 }, indent: { left: 80 } }),
        ] }),
      ] }),
      // Row 4: DSP Permit (full width)
      new TableRow({ children: [new TableCell({ columnSpan: 2, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
        new Paragraph({ children: [r("1g.  Plant, Registry, or DSP Permit Number", false, 15, true, "555555")], spacing: { before: 30 }, indent: { left: 80 } }),
        new Paragraph({ children: [r(data.dspNumber ?? "NOT CONFIGURED — set this in Settings", false, 18)], spacing: { after: 50 }, indent: { left: 80 } }),
      ] })] }),
      // Row 5: Name and Address (full width)
      new TableRow({ children: [new TableCell({ columnSpan: 2, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
        new Paragraph({ children: [r("1h.  Name and Address of Registrant", false, 15, true, "555555")], spacing: { before: 30 }, indent: { left: 80 } }),
        new Paragraph({ children: [r(`${data.proprietorName}${data.address ? `  ·  ${data.address}` : ""}`, false, 18)], spacing: { after: 50 }, indent: { left: 80 } }),
      ] })] }),
      // Row 6: Checkbox original/amended
      new TableRow({ children: [new TableCell({ columnSpan: 2, shading: { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [
        new Paragraph({ children: [r("☑  Original Return     ☐  Amended Return     Commodity type filed: Distilled Spirits", false, 17)], spacing: { before: 50, after: 50 }, indent: { left: 80 } }),
      ] })] }),
    ],
  }), sp(120));

  // ── PART II — Tax on Distilled Spirits ───────────────────────────────────────
  // This is the core TTB 5000.24 tax calculation table
  children.push(sectionBar("PART II — TAX ON DISTILLED SPIRITS"), sp(0));

  const rateClasses = [
    { line: "1", desc: "Craft Distillery — Tier 1", note: "First 100,000 proof gallons removed per calendar year  (IRC §5001(c)(1))", rate: 2.70,  pg: totalPG,  tax: totalTax,  active: true  },
    { line: "2", desc: "Craft Distillery — Tier 2", note: "100,001 to 22,230,000 proof gallons per calendar year  (IRC §5001(c)(2))", rate: 13.34, pg: 0,        tax: 0,         active: false },
    { line: "3", desc: "Standard Rate",              note: "More than 22,230,000 proof gallons or non-qualifying  (IRC §5001(a)(1))", rate: 13.50, pg: 0,        tax: 0,         active: false },
  ];

  children.push(fixedTable2({
    width: { size: W, type: WidthType.DXA },
    rows: [
      // Column headers
      new TableRow({ tableHeader: true, children: [
        new TableCell({ width: { size: 640, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Line", true, 17)], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 4920, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Kind of Spirits / Rate Class", true, 17)], spacing: { before: 60, after: 60 }, indent: { left: 80 } })] }),
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Rate ($/PG)", true, 17)], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 1300, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Proof Gallons", true, 17)], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 1300, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Tax Amount", true, 17)], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
      ] }),
      // Rate class rows
      ...rateClasses.map((rc, i) => new TableRow({ children: [
        new TableCell({ width: { size: 640, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(rc.line, false, 17, false, "888888")], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 4920, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [
          new Paragraph({ children: [r(rc.desc, rc.active, 18, false, rc.active ? BLACK : "888888")], spacing: { before: 40 }, indent: { left: 80 } }),
          new Paragraph({ children: [r(rc.note, false, 15, true, "777777")], spacing: { after: 50 }, indent: { left: 80 } }),
        ] }),
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(`$${rc.rate.toFixed(2)}`, false, 17, false, rc.active ? BLACK : "AAAAAA")], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(rc.active ? rc.pg.toFixed(4) : "—", rc.active, 17, false, rc.active ? BLACK : "AAAAAA")], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(rc.active ? money(rc.tax) : "—", rc.active, 17, false, rc.active ? BLACK : "AAAAAA")], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
      ] })),
      // Totals row
      new TableRow({ children: [
        new TableCell({ width: { size: 640, type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r("", true, 17)], spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 4920, type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r("TOTAL DISTILLED SPIRITS TAX  (carry to Summary, Line 1)", true, 18)], spacing: { before: 60, after: 60 }, indent: { left: 80 } })] }),
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r("", true, 17)], spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r(totalPG.toFixed(4), true, 19)], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r(money(totalTax), true, 19)], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
      ] }),
    ],
  }));

  children.push(
    new Paragraph({ children: [r("Formula: Cases × 1.19 gal/case × (ABV% × 2 ÷ 100) = Proof Gallons  ·  Per Bottle = Excise Tax ÷ 6 bottles/case  ·  See Attachment for product detail.", false, 15, true, "777777")], spacing: { before: 50, after: 100 } }),
  );

  // ── PART III — Other Commodities (N/A) ──────────────────────────────────────
  children.push(sectionBar("PART III — OTHER COMMODITIES  (Not applicable for distilled spirits only operations)"), sp(0));
  children.push(fixedTable2({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        new TableCell({ width: { size: 7560, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Commodity", true, 17)], spacing: { before: 50, after: 50 }, indent: { left: 80 } })] }),
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Tax Amount", true, 17)], alignment: AlignmentType.RIGHT, spacing: { before: 50, after: 50 } })] }),
      ] }),
      ...(["Wines", "Beer", "Cigars", "Cigarettes", "Chewing Tobacco / Snuff", "Pipe Tobacco / Roll-Your-Own Tobacco"] as const).map((name, i) =>
        new TableRow({ children: [
          new TableCell({ width: { size: 7560, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(name, false, 17, false, "888888")], spacing: { before: 50, after: 50 }, indent: { left: 80 } })] }),
          new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r("N/A", false, 17, false, "AAAAAA")], alignment: AlignmentType.RIGHT, spacing: { before: 50, after: 50 } })] }),
        ] })
      ),
    ],
  }), sp(120));

  // ── PART IV — Summary of Tax Due ─────────────────────────────────────────────
  children.push(sectionBar("PART IV — SUMMARY OF TAX DUE"), sp(0));

  const summaryLines: [string, string, string, boolean][] = [
    ["1",  "Distilled Spirits (total from Part II)",                         money(totalTax),  false],
    ["2",  "Wines",                                                            "$0.00",          false],
    ["3",  "Beer",                                                             "$0.00",          false],
    ["4",  "Cigars",                                                           "$0.00",          false],
    ["5",  "Cigarettes",                                                       "$0.00",          false],
    ["6",  "Chewing Tobacco / Snuff",                                          "$0.00",          false],
    ["7",  "Pipe Tobacco / Roll-Your-Own Tobacco",                             "$0.00",          false],
    ["8",  "TOTAL TAX LIABILITY  (Sum of Lines 1 through 7)",                  money(totalTax),  true ],
    ["9",  "Adjustments Increasing Amount Due (from Schedule A, attach form)", "$0.00",          false],
    ["10", "TOTAL ADJUSTED TAX DUE  (Line 8 plus Line 9)",                    money(totalTax),  true ],
    ["11", "Adjustments Decreasing Amount Due (from Schedule B, attach form)", "$0.00",          false],
    ["12", "NET AMOUNT DUE  (Line 10 minus Line 11)  ← REMIT THIS AMOUNT",   money(totalTax),  true ],
  ];

  children.push(fixedTable2({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        new TableCell({ width: { size: 640, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Line", true, 17)], alignment: AlignmentType.CENTER, spacing: { before: 50, after: 50 } })] }),
        new TableCell({ width: { size: 6920, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Description", true, 17)], spacing: { before: 50, after: 50 }, indent: { left: 120 } })] }),
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Amount", true, 17)], alignment: AlignmentType.RIGHT, spacing: { before: 50, after: 50 } })] }),
      ] }),
      ...summaryLines.map(([line, desc, amt, isKey]) => new TableRow({ children: [
        new TableCell({ width: { size: 640, type: WidthType.DXA }, borders: { top: isKey ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, shading: isKey ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(line, isKey, 17)], alignment: AlignmentType.CENTER, spacing: { before: 55, after: 55 } })] }),
        new TableCell({ width: { size: 6920, type: WidthType.DXA }, borders: { top: isKey ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, shading: isKey ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(desc, isKey, 18)], spacing: { before: 55, after: 55 }, indent: { left: 120 } })] }),
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders: { top: isKey ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, shading: isKey ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(amt, isKey, isKey ? 20 : 18)], alignment: AlignmentType.RIGHT, spacing: { before: 55, after: 55 } })] }),
      ] })),
    ],
  }), sp(120));

  // ── PART V — Adjustments (Schedules A & B) ───────────────────────────────────
  for (const [letter, title, ref] of [
    ["A", "SCHEDULE A — ADJUSTMENTS INCREASING AMOUNT DUE", "(carry subtotal to Summary Line 9)"],
    ["B", "SCHEDULE B — ADJUSTMENTS DECREASING AMOUNT DUE", "(carry subtotal to Summary Line 11)"],
  ] as const) {
    children.push(sectionBar(`${title}  ${ref}`), sp(0));
    children.push(fixedTable2({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({ tableHeader: true, children: [
          new TableCell({ width: { size: 4160, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Explanation of Error or Transaction", true, 16)], spacing: { before: 40, after: 40 }, indent: { left: 80 } })] }),
          new TableCell({ width: { size: 1600, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Product", true, 16)], alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 } })] }),
          new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("(a) Tax", true, 16)], alignment: AlignmentType.RIGHT, spacing: { before: 40, after: 40 } })] }),
          new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("(b) Interest", true, 16)], alignment: AlignmentType.RIGHT, spacing: { before: 40, after: 40 } })] }),
          new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("(c) Penalty", true, 16)], alignment: AlignmentType.RIGHT, spacing: { before: 40, after: 40 } })] }),
        ] }),
        ...[1, 2, 3].map(() => new TableRow({ children: [4160, 1600, 1200, 1200, 1200].map((w) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r(" ", false, 18)], spacing: { before: 70, after: 70 } })] })) })),
        new TableRow({ children: [
          new TableCell({ width: { size: 5760, type: WidthType.DXA }, columnSpan: 2, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r("Subtotals", true, 17)], spacing: { before: 50, after: 50 }, indent: { left: 80 } })] }),
          ...(["$0.00", "$0.00", "$0.00"]).map((v) => new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [r(v, true, 17)], alignment: AlignmentType.RIGHT, spacing: { before: 50, after: 50 } })] })),
        ] }),
      ],
    }));
    children.push(sp(80));
  }

  children.push(sp(40));

  // ── PART VI — Certification ──────────────────────────────────────────────────
  children.push(
    sectionBar("PART VI — CERTIFICATION"),
    sp(40),
    new Paragraph({
      children: [r("Under penalties of perjury, I declare that I have examined this return, including accompanying schedules and statements, and to the best of my knowledge and belief it is true, correct, and complete. Declaration of preparer (other than taxpayer) is based on all information of which preparer has any knowledge.", false, 17, true)],
      border: { left: { style: BorderStyle.SINGLE, size: 8, color: BLACK } },
      indent: { left: 120, right: 120 },
      spacing: { before: 40, after: 120 },
    }),
    fixedTable2({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [
          new TableCell({ width: { size: 5200, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r("Signature of Proprietor or Authorized Official", false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
          new TableCell({ width: { size: 400, type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [sp(0)] }),
          new TableCell({ width: { size: 3760, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r("Date", false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
        ] }),
        new TableRow({ children: [
          new TableCell({ width: { size: 5200, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r("Printed Name and Title / Position", false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
          new TableCell({ width: { size: 400, type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [sp(0)] }),
          new TableCell({ width: { size: 3760, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r(`DSP Permit No.:  ${data.dspNumber ?? "_______________________"}`, false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
        ] }),
        new TableRow({ children: [
          new TableCell({ width: { size: 9360, type: WidthType.DXA }, columnSpan: 3, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, children: [new Paragraph({ children: [r(`EIN:  ${data.ein ?? "___________________________"}     ·     Telephone:  _______________________     ·     Email:  _________________________________________`, false, 16, true, "555555")], spacing: { before: 60, after: 80 } })] }),
        ] }),
      ],
    }),
    sp(80),
    new Paragraph({
      children: [r(`TTB Form 5000.24  ·  ${periodLabel(data.month)}  ·  ${data.proprietorName}  ·  Generated by Distillr ERP`, false, 15, true, "888888")],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
      spacing: { before: 60 },
    }),
  );

  // ── PAGE BREAK → Supporting Product Detail ───────────────────────────────────
  children.push(
    new Paragraph({ children: [new PageBreak()], spacing: { after: 60 } }),
    center("ATTACHMENT TO TTB FORM 5000.24", true, 20),
    center(`Supporting Schedule — Excise Tax Detail by Product`, false, 17),
    center(`${data.proprietorName}  ·  ${periodLabel(data.month)}  ·  DSP ${data.dspNumber ?? "N/A"}`, false, 16),
    new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLACK } }, spacing: { after: 80 } }),
    sp(20),
  );

  if (!ebp || ebp.rows.length === 0) {
    children.push(new Paragraph({ children: [r("No product data recorded for this period.", false, 17, true, "888888")], spacing: { after: 80 } }));
  } else {
    // Attachment column widths: 2400+880+880+880+680+1200+1460+980 = 9360
    const PCOL = [2400, 880, 880, 880, 680, 1200, 1460, 980];
    const PHDRS = ["Product", "Dist.\nCases", "Retail\nCases", "Total\nCases", "ABV %", "Proof\nGallons", "Excise\nTax", "Per\nBottle"];

    children.push(fixedTable2({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({ tableHeader: true, children: PHDRS.map((h, i) => new TableCell({
          width: { size: PCOL[i], type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
          borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [r(h, true, 16)], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, spacing: { before: 40, after: 40 }, indent: i === 0 ? { left: 80 } : undefined })],
        })) }),
        ...ebp.rows.map((row, ri) => {
          const active = row.totalCases > 0;
          return new TableRow({ children: PHDRS.map((_, i) => {
            const vals = [
              row.name,
              active ? String(row.distCases)              : "—",
              active ? String(row.retailCases)             : "—",
              active ? String(row.totalCases)              : "—",
              `${row.abv.toFixed(1)}%`,
              active ? row.proofGallons.toFixed(4)         : "—",
              active ? money(row.exciseTax)                : "—",
              active ? `$${row.perBottle.toFixed(4)}`      : "—",
            ];
            return new TableCell({
              width: { size: PCOL[i], type: WidthType.DXA },
              borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
              shading: !active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : ri % 2 === 1 ? { type: ShadingType.SOLID, color: "FAFAFA", fill: "FAFAFA" } : undefined,
              children: [new Paragraph({ children: [r(vals[i], false, 16, false, active ? BLACK : "AAAAAA")], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: { before: 35, after: 35 }, indent: i === 0 ? { left: 80 } : undefined })],
            });
          }) });
        }),
        new TableRow({ children: ["TOTALS", String(ebp.totalDistCases), String(ebp.totalRetailCases), String(ebp.totalCases), "", ebp.totalProofGallons.toFixed(4), money(ebp.totalExciseTax), ""].map((v, i) => new TableCell({
          width: { size: PCOL[i], type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
          borders: { top: DBL, bottom: THIN, left: THIN, right: THIN },
          children: [new Paragraph({ children: [r(v, true, 17)], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: { before: 50, after: 50 }, indent: i === 0 ? { left: 80 } : undefined })],
        })) }),
      ],
    }));
    children.push(
      new Paragraph({ children: [r("Formula: Cases × 1.19 gal/case × (ABV% × 2 ÷ 100) = Proof Gallons  ·  Rate: $2.70/PG (Craft Tier 1 — IRC §5001(c)(1))  ·  Per Bottle = Excise Tax ÷ 6", false, 15, true, "777777")], spacing: { before: 50, after: 80 } }),
    );
  }

  children.push(
    new Paragraph({
      children: [r(`Attachment  ·  TTB Form 5000.24  ·  ${periodLabel(data.month)}  ·  ${data.proprietorName}  ·  Generated by Distillr ERP`, false, 14, true, "AAAAAA")],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" } },
      spacing: { before: 40 },
    }),
  );

  const doc = new Document({
    creator: "Distillr ERP",
    title: `TTB 5000.24 — ${data.proprietorName} — ${periodLabel(data.month)}`,
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `TTB_5000_24_${data.proprietorName.replace(/\s+/g, "_")}_${data.month}.docx`);
}
