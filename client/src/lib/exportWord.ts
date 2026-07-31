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
    ShadingType, VerticalAlign, TableLayoutType,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const s = data.summary;
  const { start, end } = periodRange(data.month);

  // ── Palette ──────────────────────────────────────────────────────────────────
  const FONT  = "Times New Roman";
  const BLACK = "000000";
  const WHITE = "FFFFFF";
  const LGRAY = "F2F2F2";
  const HGRAY = "D9D9D9";
  const NONE  = { style: BorderStyle.NONE,   size: 0,  color: WHITE } as const;
  const THIN  = { style: BorderStyle.SINGLE, size: 4,  color: BLACK } as const;
  const THICK = { style: BorderStyle.SINGLE, size: 12, color: BLACK } as const;
  const DBL   = { style: BorderStyle.DOUBLE, size: 6,  color: BLACK } as const;

  // 0.75" margins on 8.5" page → 10,080 DXA usable width
  const MARGIN = 1080; // 0.75 inch in DXA
  const W = 10080;

  // Standard cell padding applied to every cell for readability
  const PAD = { top: 90, bottom: 90, left: 140, right: 100 };

  function fixedTable(opts: ConstructorParameters<typeof Table>[0]): Table {
    return new Table({ layout: TableLayoutType.FIXED, ...opts });
  }

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
        width: { size: W, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
        borders: { top: THICK, bottom: THICK, left: THICK, right: THICK },
        margins: PAD,
        children: [new Paragraph({ children: [r(text, true, 20)] })],
      })] })],
    });
  }

  function colHeader(text: string, width: number, align = AlignmentType.CENTER): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
      borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
      margins: PAD,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [r(text, true, 18)], alignment: align })],
    });
  }

  function cell(text: string, width: number, align = AlignmentType.LEFT, bold = false, shade = false): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
      margins: PAD,
      shading: shade ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined,
      children: [new Paragraph({ children: [r(text || "—", bold, 19)], alignment: align })],
    });
  }

  function totalCell(text: string, width: number, align = AlignmentType.LEFT): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: { top: DBL, bottom: THIN, left: THIN, right: THIN },
      margins: PAD,
      shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
      children: [new Paragraph({ children: [r(text, true, 20)], alignment: align })],
    });
  }

  const doc_children: any[] = [];

  // ── Header ───────────────────────────────────────────────────────────────────
  doc_children.push(
    new Paragraph({ children: [r("OMB No. 1513-0003", false, 16, true, "555555")], alignment: AlignmentType.RIGHT, spacing: { after: 20 } }),
    center("DEPARTMENT OF THE TREASURY", true, 22),
    center("Alcohol and Tobacco Tax and Trade Bureau (TTB)", false, 20),
    new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLACK } }, spacing: { after: 60 } }),
    center("DISTILLED SPIRITS PLANT", true, 28),
    center("MONTHLY REPORT OF PRODUCTION OPERATIONS", true, 24),
    center("TTB Form 5110.40  (Rev. 10/2023)", false, 18),
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

  // Label col: 2800, Value col: 7280
  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: idRows.map(([lbl, val]) => new TableRow({ children: [
      new TableCell({ width: { size: 2800, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r(lbl, true, 19)] })] }),
      new TableCell({ width: { size: 7280, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r(val || " ", false, 19)] })] }),
    ] })),
  }), sp(120));

  // ── PART II — Spirits Produced ───────────────────────────────────────────────
  doc_children.push(sectionBar("PART II — SPIRITS PRODUCED  (By distillation date within the reporting period)"), sp(0));

  // 2100 + 1500 + 900 + 3880 + 1700 = 10080
  const P2 = [2100, 1500, 900, 3880, 1700];
  const prodRows = (s?.produced_by_spirit ?? []).map((r2, i) => new TableRow({ children: [
    cell(cap(r2.spiritType),                        P2[0], AlignmentType.LEFT,   false, i % 2 === 1),
    cell(cap(r2.spiritClass) || "—",                P2[1], AlignmentType.LEFT,   false, i % 2 === 1),
    cell(String(r2.batchCount),                     P2[2], AlignmentType.CENTER, false, i % 2 === 1),
    cell((r2.batchCodes ?? []).join(", ") || "—",   P2[3], AlignmentType.LEFT,   false, i % 2 === 1),
    cell(pg(r2.proofGallons),                       P2[4], AlignmentType.RIGHT,  false, i % 2 === 1),
  ] }));
  if (prodRows.length === 0)
    prodRows.push(new TableRow({ children: [cell("No spirits produced in this period.", P2[0]+P2[1]+P2[2]+P2[3], AlignmentType.LEFT), cell("—", P2[4], AlignmentType.RIGHT)] }));

  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        colHeader("Spirit Type / Kind",  P2[0], AlignmentType.LEFT),
        colHeader("Class",               P2[1], AlignmentType.LEFT),
        colHeader("Batches",             P2[2]),
        colHeader("Batch Codes",         P2[3], AlignmentType.LEFT),
        colHeader("Proof Gallons",       P2[4], AlignmentType.RIGHT),
      ] }),
      ...prodRows,
      new TableRow({ children: [
        totalCell(`TOTAL  (${s?.prod_batch_count ?? 0} batches)`, P2[0]+P2[1]+P2[2]+P2[3], AlignmentType.LEFT),
        totalCell(pg(s?.total_produced), P2[4], AlignmentType.RIGHT),
      ] }),
    ],
  }), sp(120));

  // ── PART III — Spirits Deposited to Bond ────────────────────────────────────
  doc_children.push(sectionBar("PART III — SPIRITS DEPOSITED TO BOND  (By fill/barrel date within the reporting period)"), sp(0));

  // 1600 + 1200 + 2680 + 800 + 1100 + 900 + 1800 = 10080
  const P3 = [1600, 1200, 2680, 800, 1100, 900, 1800];
  const depRows = (s?.deposited_by_spirit ?? []).map((r2, i) => new TableRow({ children: [
    cell(cap(r2.spiritType),                        P3[0], AlignmentType.LEFT,   false, i % 2 === 1),
    cell(cap(r2.spiritClass) || "—",                P3[1], AlignmentType.LEFT,   false, i % 2 === 1),
    cell(r2.fillNumbers || "—",                     P3[2], AlignmentType.LEFT,   false, i % 2 === 1),
    cell(String(r2.barrelCount),                    P3[3], AlignmentType.CENTER, false, i % 2 === 1),
    cell(pg(r2.wineGallons),                        P3[4], AlignmentType.RIGHT,  false, i % 2 === 1),
    cell(`${(r2.avgFillProof ?? 0).toFixed(1)}°`,  P3[5], AlignmentType.RIGHT,  false, i % 2 === 1),
    cell(pg(r2.proofGallons),                       P3[6], AlignmentType.RIGHT,  false, i % 2 === 1),
  ] }));
  if (depRows.length === 0)
    depRows.push(new TableRow({ children: [cell("No spirits deposited in this period.", W, AlignmentType.LEFT)] }));

  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        colHeader("Spirit Type",            P3[0], AlignmentType.LEFT),
        colHeader("Class",                  P3[1], AlignmentType.LEFT),
        colHeader("Fill / Barrel Numbers",  P3[2], AlignmentType.LEFT),
        colHeader("Barrels",               P3[3]),
        colHeader("Wine Gal.",             P3[4], AlignmentType.RIGHT),
        colHeader("Avg Proof",             P3[5], AlignmentType.RIGHT),
        colHeader("Proof Gallons",         P3[6], AlignmentType.RIGHT),
      ] }),
      ...depRows,
      new TableRow({ children: [
        totalCell("TOTAL",                                                                                         P3[0]+P3[1]+P3[2], AlignmentType.LEFT),
        totalCell(String(s?.deposited_by_spirit?.reduce((a, r2) => a + r2.barrelCount, 0) ?? 0),                  P3[3], AlignmentType.CENTER),
        totalCell(pg(s?.total_fill_wine_gallons),                                                                  P3[4], AlignmentType.RIGHT),
        totalCell("",                                                                                              P3[5], AlignmentType.RIGHT),
        totalCell(pg(s?.total_deposited),                                                                          P3[6], AlignmentType.RIGHT),
      ] }),
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

  // 7880 + 2200 = 10080
  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        colHeader("Description",    7880, AlignmentType.LEFT),
        colHeader("Proof Gallons",  2200, AlignmentType.RIGHT),
      ] }),
      ...ledger.map(([desc, val, isTotal]) => new TableRow({ children: [
        new TableCell({ width: { size: 7880, type: WidthType.DXA }, borders: { top: isTotal ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: isTotal ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(desc, isTotal, 19)] })] }),
        new TableCell({ width: { size: 2200, type: WidthType.DXA }, borders: { top: isTotal ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: isTotal ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(val, isTotal, isTotal ? 20 : 19)], alignment: AlignmentType.RIGHT })] }),
      ] })),
    ],
  }));

  doc_children.push(
    sp(40),
    new Paragraph({
      children: [
        r("Warehouse Snapshot (as of report generation date):  ", true, 18),
        r(`${s?.barrels_in_bond_count ?? 0} barrel(s) aging  ·  ${pg(s?.barrels_in_bond_wg)} wine gallons  ·  ${pg(s?.barrels_in_bond_pg)} proof gallons in bond`, false, 18),
      ],
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: BLACK } },
      indent: { left: 160, right: 120 },
      spacing: { before: 60, after: 120 },
    }),
  );

  // ── PART V — Spirits Processed / Bottled ────────────────────────────────────
  doc_children.push(sectionBar("PART V — SPIRITS PROCESSED / BOTTLED  (By bottling date — taxable removals from bond)"), sp(0));

  // 1300 + 1000 + 2000 + 800 + 800 + 740 + 800 + 800 + 1000 + 1840 = 11080 – too wide
  // 1200 + 960 + 1960 + 780 + 780 + 720 + 780 + 780 + 980 + 1140 = 10080 ✓
  const P5 = [1200, 960, 1960, 780, 780, 720, 780, 780, 980, 1140];
  const procRows = (s?.processed_by_spirit ?? []).map((r2, i) => new TableRow({ children: [
    cell(cap(r2.spiritType),                              P5[0], AlignmentType.LEFT,   false, i % 2 === 1),
    cell(cap(r2.spiritClass) || "—",                      P5[1], AlignmentType.LEFT,   false, i % 2 === 1),
    cell((r2.lotNumbers ?? []).join(", ") || "—",         P5[2], AlignmentType.LEFT,   false, i % 2 === 1),
    cell(`${(r2.avgBottlingProof ?? 0).toFixed(1)}°`,    P5[3], AlignmentType.RIGHT,  false, i % 2 === 1),
    cell(String(r2.cases750  || "—"),                    P5[4], AlignmentType.RIGHT,  false, i % 2 === 1),
    cell(String(r2.cases1000 || "—"),                    P5[5], AlignmentType.RIGHT,  false, i % 2 === 1),
    cell(String(r2.cases1750 || "—"),                    P5[6], AlignmentType.RIGHT,  false, i % 2 === 1),
    cell(String(r2.totalCases),                           P5[7], AlignmentType.RIGHT,  false, i % 2 === 1),
    cell(pg(r2.proofGallons),                             P5[8], AlignmentType.RIGHT,  false, i % 2 === 1),
    cell(money(r2.exciseTaxDue),                          P5[9], AlignmentType.RIGHT,  false, i % 2 === 1),
  ] }));
  if (procRows.length === 0)
    procRows.push(new TableRow({ children: [cell("No spirits processed in this period.", W, AlignmentType.LEFT)] }));

  doc_children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        colHeader("Spirit Type",   P5[0], AlignmentType.LEFT),
        colHeader("Class",         P5[1], AlignmentType.LEFT),
        colHeader("Lot Numbers",   P5[2], AlignmentType.LEFT),
        colHeader("Proof",         P5[3], AlignmentType.RIGHT),
        colHeader("750mL cs",      P5[4], AlignmentType.RIGHT),
        colHeader("1 L cs",        P5[5], AlignmentType.RIGHT),
        colHeader("1.75L cs",      P5[6], AlignmentType.RIGHT),
        colHeader("Total cs",      P5[7], AlignmentType.RIGHT),
        colHeader("PG Removed",    P5[8], AlignmentType.RIGHT),
        colHeader("Excise Tax",    P5[9], AlignmentType.RIGHT),
      ] }),
      ...procRows,
      new TableRow({ children: [
        totalCell("TOTAL PROCESSED",                          P5[0]+P5[1]+P5[2], AlignmentType.LEFT),
        totalCell("",                                         P5[3], AlignmentType.RIGHT),
        totalCell(String(s?.total_cases_750  ?? 0),          P5[4], AlignmentType.RIGHT),
        totalCell(String(s?.total_cases_1000 ?? 0),          P5[5], AlignmentType.RIGHT),
        totalCell(String(s?.total_cases_1750 ?? 0),          P5[6], AlignmentType.RIGHT),
        totalCell(String(s?.grand_total_cases ?? 0),          P5[7], AlignmentType.RIGHT),
        totalCell(pg(s?.total_processed),                     P5[8], AlignmentType.RIGHT),
        totalCell(money(s?.total_excise_tax),                 P5[9], AlignmentType.RIGHT),
      ] }),
    ],
  }), sp(180));

  // ── Certification ────────────────────────────────────────────────────────────
  doc_children.push(
    new Paragraph({ children: [r("CERTIFICATION", true, 22)], spacing: { before: 0, after: 60 } }),
    new Paragraph({
      children: [r("Under penalties of perjury, I declare that I have examined this report, including accompanying schedules and statements, and to the best of my knowledge and belief it is true, correct, and complete.", false, 18, true)],
      border: { left: { style: BorderStyle.SINGLE, size: 8, color: BLACK } },
      indent: { left: 120, right: 120 },
      spacing: { before: 40, after: 120 },
    }),
    fixedTable({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [
          new TableCell({ width: { size: 5800, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r("Signature of Proprietor or Authorized Agent", false, 17, true, "555555")] })] }),
          new TableCell({ width: { size: 400,  type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [sp(0)] }),
          new TableCell({ width: { size: 3880, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r("Date", false, 17, true, "555555")] })] }),
        ] }),
        new TableRow({ children: [
          new TableCell({ width: { size: 5800, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r("Printed Name and Title", false, 17, true, "555555")] })] }),
          new TableCell({ width: { size: 400,  type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [sp(0)] }),
          new TableCell({ width: { size: 3880, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r(`DSP Permit No.:  ${data.dspNumber ?? "_______________________"}`, false, 17, true, "555555")] })] }),
        ] }),
      ],
    }),
    sp(80),
    new Paragraph({
      children: [r(`TTB Form 5110.40  ·  ${periodLabel(data.month)}  ·  ${data.proprietorName}  ·  Generated by Distillr Software`, false, 15, true, "888888")],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
      spacing: { before: 60 },
    }),
  );

  const doc = new Document({
    creator: "Distillr Software",
    title: `TTB 5110.40 — ${data.proprietorName} — ${periodLabel(data.month)}`,
    sections: [{
      properties: { page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      children: doc_children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `TTB_5110_40_${data.proprietorName.replace(/\s+/g, "_")}_${data.month}.docx`);
}

// ─── TTB 5000.24 — Excise Tax Return ─────────────────────────────────────────

export async function export5000Word(data: WordExciseData): Promise<void> {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, BorderStyle, WidthType,
    ShadingType, VerticalAlign, PageBreak, TableLayoutType,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const ebp = data.exciseByProduct;
  const { start, end } = periodRange(data.month);
  const due = dueDate(data.month);
  const totalPG  = ebp?.totalProofGallons ?? 0;
  const totalTax = ebp?.totalExciseTax    ?? 0;

  // ── Palette ──────────────────────────────────────────────────────────────────
  const FONT  = "Times New Roman";
  const BLACK = "000000";
  const WHITE = "FFFFFF";
  const LGRAY = "F2F2F2";
  const HGRAY = "D9D9D9";
  const NONE  = { style: BorderStyle.NONE,   size: 0,  color: WHITE } as const;
  const THIN  = { style: BorderStyle.SINGLE, size: 4,  color: BLACK } as const;
  const THICK = { style: BorderStyle.SINGLE, size: 12, color: BLACK } as const;
  const DBL   = { style: BorderStyle.DOUBLE, size: 6,  color: BLACK } as const;

  const MARGIN = 1080; // 0.75 inch
  const W = 10080;
  const PAD = { top: 90, bottom: 90, left: 140, right: 100 };

  function fixedTable(opts: ConstructorParameters<typeof Table>[0]): Table {
    return new Table({ layout: TableLayoutType.FIXED, ...opts });
  }

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
        width: { size: W, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
        borders: { top: THICK, bottom: THICK, left: THICK, right: THICK },
        margins: PAD,
        children: [new Paragraph({ children: [r(text, true, 20)] })],
      })] })],
    });
  }

  // Two-col labeled field row
  function fieldRow(label: string, value: string, labelW = 3400): TableRow {
    return new TableRow({ children: [
      new TableCell({ width: { size: labelW, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r(label, true, 18)] })] }),
      new TableCell({ width: { size: W - labelW, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r(value || " ", false, 18)] })] }),
    ] });
  }

  const children: any[] = [];

  // ── Letterhead ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [r("OMB No. 1513-0083  ·  Expires: See current form", false, 16, true, "555555")], alignment: AlignmentType.RIGHT, spacing: { after: 20 } }),
    center("DEPARTMENT OF THE TREASURY", true, 22),
    center("Alcohol and Tobacco Tax and Trade Bureau (TTB)", false, 20),
    new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLACK } }, spacing: { after: 60 } }),
    center("EXCISE TAX RETURN", true, 30),
    center("TTB Form 5000.24  (Rev. 10/2021)  ·  Distilled Spirits", false, 18),
    sp(80),
  );

  // ── PART I — Identification ───────────────────────────────────────────────────
  children.push(sectionBar("PART I — IDENTIFICATION AND FILING INFORMATION"), sp(0));

  // Two-column grid for identification fields
  // Each half = 5040 DXA
  children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ children: [
        new TableCell({ width: { size: 5040, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
          new Paragraph({ children: [r("1a.  Serial Number / Reference", false, 15, true, "555555")], spacing: { after: 20 } }),
          new Paragraph({ children: [r(`${data.dspNumber ?? "N/A"}-${data.month}`, true, 20)] }),
        ] }),
        new TableCell({ width: { size: 5040, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
          new Paragraph({ children: [r("1b.  Amount of Tax Payment", false, 15, true, "555555")], spacing: { after: 20 } }),
          new Paragraph({ children: [r(money(totalTax), true, 20)] }),
        ] }),
      ] }),
      new TableRow({ children: [
        new TableCell({ width: { size: 5040, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
          new Paragraph({ children: [r("1c.  Form of Payment", false, 15, true, "555555")], spacing: { after: 20 } }),
          new Paragraph({ children: [r("☑  Electronic Funds Transfer (EFT) via Pay.gov", false, 19)] }),
        ] }),
        new TableCell({ width: { size: 5040, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
          new Paragraph({ children: [r("1d.  Return Covers Period", false, 15, true, "555555")], spacing: { after: 20 } }),
          new Paragraph({ children: [r(`${start}  through  ${end}`, false, 19)] }),
        ] }),
      ] }),
      new TableRow({ children: [
        new TableCell({ width: { size: 5040, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
          new Paragraph({ children: [r("1e.  Date Payment Due", false, 15, true, "555555")], spacing: { after: 20 } }),
          new Paragraph({ children: [r(due, false, 19)] }),
        ] }),
        new TableCell({ width: { size: 5040, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
          new Paragraph({ children: [r("1f.  Employer Identification Number (EIN)", false, 15, true, "555555")], spacing: { after: 20 } }),
          new Paragraph({ children: [r(data.ein ?? "________________________________", false, 19)] }),
        ] }),
      ] }),
      new TableRow({ children: [new TableCell({ columnSpan: 2, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
        new Paragraph({ children: [r("1g.  Plant, Registry, or DSP Permit Number", false, 15, true, "555555")], spacing: { after: 20 } }),
        new Paragraph({ children: [r(data.dspNumber ?? "NOT CONFIGURED — set this in Settings", false, 19)] }),
      ] })] }),
      new TableRow({ children: [new TableCell({ columnSpan: 2, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
        new Paragraph({ children: [r("1h.  Name and Address of Registrant", false, 15, true, "555555")], spacing: { after: 20 } }),
        new Paragraph({ children: [r(`${data.proprietorName}${data.address ? `  ·  ${data.address}` : ""}`, false, 19)] }),
      ] })] }),
      new TableRow({ children: [new TableCell({ columnSpan: 2, shading: { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [
        new Paragraph({ children: [r("☑  Original Return     ☐  Amended Return     Commodity type filed: Distilled Spirits", false, 18)] }),
      ] })] }),
    ],
  }), sp(120));

  // ── PART II — Tax on Distilled Spirits ───────────────────────────────────────
  children.push(sectionBar("PART II — TAX ON DISTILLED SPIRITS"), sp(0));

  const rateClasses = [
    { line: "1", desc: "Craft Distillery — Tier 1", note: "First 100,000 proof gallons removed per calendar year  (IRC §5001(c)(1))", rate: 2.70,  pg: totalPG,  tax: totalTax,  active: true  },
    { line: "2", desc: "Craft Distillery — Tier 2", note: "100,001 to 22,230,000 proof gallons per calendar year  (IRC §5001(c)(2))", rate: 13.34, pg: 0,        tax: 0,         active: false },
    { line: "3", desc: "Standard Rate",              note: "More than 22,230,000 proof gallons or non-qualifying  (IRC §5001(a)(1))", rate: 13.50, pg: 0,        tax: 0,         active: false },
  ];

  // 700 + 5380 + 1400 + 1400 + 1200 = 10080
  const RC = [700, 5380, 1400, 1400, 1200];
  children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        new TableCell({ width: { size: RC[0], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Line", true, 18)], alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: RC[1], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Kind of Spirits / Rate Class", true, 18)] })] }),
        new TableCell({ width: { size: RC[2], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Rate ($/PG)", true, 18)], alignment: AlignmentType.RIGHT })] }),
        new TableCell({ width: { size: RC[3], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Proof Gallons", true, 18)], alignment: AlignmentType.RIGHT })] }),
        new TableCell({ width: { size: RC[4], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Tax Amount", true, 18)], alignment: AlignmentType.RIGHT })] }),
      ] }),
      ...rateClasses.map((rc) => new TableRow({ children: [
        new TableCell({ width: { size: RC[0], type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(rc.line, false, 18, false, "888888")], alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: RC[1], type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [
          new Paragraph({ children: [r(rc.desc, rc.active, 19, false, rc.active ? BLACK : "888888")], spacing: { after: 20 } }),
          new Paragraph({ children: [r(rc.note, false, 15, true, "777777")] }),
        ] }),
        new TableCell({ width: { size: RC[2], type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(`$${rc.rate.toFixed(2)}`, false, 18, false, rc.active ? BLACK : "AAAAAA")], alignment: AlignmentType.RIGHT })] }),
        new TableCell({ width: { size: RC[3], type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(rc.active ? rc.pg.toFixed(4) : "—", rc.active, 18, false, rc.active ? BLACK : "AAAAAA")], alignment: AlignmentType.RIGHT })] }),
        new TableCell({ width: { size: RC[4], type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: !rc.active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(rc.active ? money(rc.tax) : "—", rc.active, 18, false, rc.active ? BLACK : "AAAAAA")], alignment: AlignmentType.RIGHT })] }),
      ] })),
      new TableRow({ children: [
        new TableCell({ width: { size: RC[0], type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r("", true, 18)] })] }),
        new TableCell({ width: { size: RC[1], type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r("TOTAL DISTILLED SPIRITS TAX  (carry to Summary, Line 1)", true, 19)] })] }),
        new TableCell({ width: { size: RC[2], type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r("", true, 18)] })] }),
        new TableCell({ width: { size: RC[3], type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r(totalPG.toFixed(4), true, 20)], alignment: AlignmentType.RIGHT })] }),
        new TableCell({ width: { size: RC[4], type: WidthType.DXA }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, children: [new Paragraph({ children: [r(money(totalTax), true, 20)], alignment: AlignmentType.RIGHT })] }),
      ] }),
    ],
  }));

  children.push(
    new Paragraph({ children: [r("Formula: Cases × 1.19 gal/case × (ABV% × 2 ÷ 100) = Proof Gallons  ·  Per Bottle = Excise Tax ÷ 6 bottles/case  ·  See Attachment for product detail.", false, 16, true, "777777")], spacing: { before: 50, after: 100 } }),
  );

  // ── PART III — Other Commodities (N/A) ──────────────────────────────────────
  children.push(sectionBar("PART III — OTHER COMMODITIES  (Not applicable for distilled spirits only operations)"), sp(0));
  children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        new TableCell({ width: { size: 8080, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Commodity", true, 18)] })] }),
        new TableCell({ width: { size: 2000, type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Tax Amount", true, 18)], alignment: AlignmentType.RIGHT })] }),
      ] }),
      ...(["Wines", "Beer", "Cigars", "Cigarettes", "Chewing Tobacco / Snuff", "Pipe Tobacco / Roll-Your-Own Tobacco"] as const).map((name, i) =>
        new TableRow({ children: [
          new TableCell({ width: { size: 8080, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r(name, false, 18, false, "888888")] })] }),
          new TableCell({ width: { size: 2000, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : undefined, children: [new Paragraph({ children: [r("N/A", false, 18, false, "AAAAAA")], alignment: AlignmentType.RIGHT })] }),
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

  // 700 + 7380 + 2000 = 10080
  const SL = [700, 7380, 2000];
  children.push(fixedTable({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        new TableCell({ width: { size: SL[0], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Line", true, 18)], alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: SL[1], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Description", true, 18)] })] }),
        new TableCell({ width: { size: SL[2], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Amount", true, 18)], alignment: AlignmentType.RIGHT })] }),
      ] }),
      ...summaryLines.map(([line, desc, amt, isKey]) => new TableRow({ children: [
        new TableCell({ width: { size: SL[0], type: WidthType.DXA }, borders: { top: isKey ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: isKey ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(line, isKey, 18)], alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: SL[1], type: WidthType.DXA }, borders: { top: isKey ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: isKey ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(desc, isKey, 19)] })] }),
        new TableCell({ width: { size: SL[2], type: WidthType.DXA }, borders: { top: isKey ? DBL : THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, shading: isKey ? { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY } : undefined, children: [new Paragraph({ children: [r(amt, isKey, isKey ? 20 : 19)], alignment: AlignmentType.RIGHT })] }),
      ] })),
    ],
  }), sp(120));

  // ── PART V — Adjustments (Schedules A & B) ───────────────────────────────────
  for (const [letter, title, ref] of [
    ["A", "SCHEDULE A — ADJUSTMENTS INCREASING AMOUNT DUE",  "(carry subtotal to Summary Line 9)"],
    ["B", "SCHEDULE B — ADJUSTMENTS DECREASING AMOUNT DUE", "(carry subtotal to Summary Line 11)"],
  ] as const) {
    children.push(sectionBar(`${title}  ${ref}`), sp(0));
    // 4360 + 1720 + 1320 + 1340 + 1340 = 10080
    const SA = [4360, 1720, 1320, 1340, 1340];
    children.push(fixedTable({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({ tableHeader: true, children: [
          new TableCell({ width: { size: SA[0], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Explanation of Error or Transaction", true, 17)] })] }),
          new TableCell({ width: { size: SA[1], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Product", true, 17)], alignment: AlignmentType.CENTER })] }),
          new TableCell({ width: { size: SA[2], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("(a) Tax", true, 17)], alignment: AlignmentType.RIGHT })] }),
          new TableCell({ width: { size: SA[3], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("(b) Interest", true, 17)], alignment: AlignmentType.RIGHT })] }),
          new TableCell({ width: { size: SA[4], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("(c) Penalty", true, 17)], alignment: AlignmentType.RIGHT })] }),
        ] }),
        ...[1, 2, 3].map(() => new TableRow({ children: SA.map((w) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, margins: { top: 140, bottom: 140, left: 140, right: 100 }, children: [new Paragraph({ children: [r(" ", false, 19)] })] })) })),
        new TableRow({ children: [
          new TableCell({ width: { size: SA[0]+SA[1], type: WidthType.DXA }, columnSpan: 2, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r("Subtotals", true, 18)] })] }),
          ...(["$0.00", "$0.00", "$0.00"]).map((v, i) => new TableCell({ width: { size: SA[i+2], type: WidthType.DXA }, shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY }, borders: { top: DBL, bottom: THIN, left: THIN, right: THIN }, margins: PAD, children: [new Paragraph({ children: [r(v, true, 18)], alignment: AlignmentType.RIGHT })] })),
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
      children: [r("Under penalties of perjury, I declare that I have examined this return, including accompanying schedules and statements, and to the best of my knowledge and belief it is true, correct, and complete. Declaration of preparer (other than taxpayer) is based on all information of which preparer has any knowledge.", false, 18, true)],
      border: { left: { style: BorderStyle.SINGLE, size: 8, color: BLACK } },
      indent: { left: 120, right: 120 },
      spacing: { before: 40, after: 120 },
    }),
    fixedTable({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [
          new TableCell({ width: { size: 5800, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r("Signature of Proprietor or Authorized Official", false, 17, true, "555555")] })] }),
          new TableCell({ width: { size: 480,  type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [sp(0)] }),
          new TableCell({ width: { size: 3800, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r("Date", false, 17, true, "555555")] })] }),
        ] }),
        new TableRow({ children: [
          new TableCell({ width: { size: 5800, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r("Printed Name and Title / Position", false, 17, true, "555555")] })] }),
          new TableCell({ width: { size: 480,  type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [sp(0)] }),
          new TableCell({ width: { size: 3800, type: WidthType.DXA }, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r(`DSP Permit No.:  ${data.dspNumber ?? "_______________________"}`, false, 17, true, "555555")] })] }),
        ] }),
        new TableRow({ children: [
          new TableCell({ width: { size: W, type: WidthType.DXA }, columnSpan: 3, borders: { top: NONE, bottom: THIN, left: NONE, right: NONE }, margins: { top: 60, bottom: 90, left: 0, right: 0 }, children: [new Paragraph({ children: [r(`EIN:  ${data.ein ?? "___________________________"}     ·     Telephone:  _______________________     ·     Email:  _________________________________________`, false, 17, true, "555555")] })] }),
        ] }),
      ],
    }),
    sp(80),
    new Paragraph({
      children: [r(`TTB Form 5000.24  ·  ${periodLabel(data.month)}  ·  ${data.proprietorName}  ·  Generated by Distillr Software`, false, 15, true, "888888")],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
      spacing: { before: 60 },
    }),
  );

  // ── PAGE BREAK → Supporting Product Detail ───────────────────────────────────
  children.push(
    new Paragraph({ children: [new PageBreak()], spacing: { after: 60 } }),
    center("ATTACHMENT TO TTB FORM 5000.24", true, 22),
    center("Supporting Schedule — Excise Tax Detail by Product", false, 18),
    center(`${data.proprietorName}  ·  ${periodLabel(data.month)}  ·  DSP ${data.dspNumber ?? "N/A"}`, false, 17),
    new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLACK } }, spacing: { after: 80 } }),
    sp(20),
  );

  if (!ebp || ebp.rows.length === 0) {
    children.push(new Paragraph({ children: [r("No product data recorded for this period.", false, 18, true, "888888")], spacing: { after: 80 } }));
  } else {
    // 2800 + 1000 + 1000 + 1000 + 800 + 1280 + 1560 + 640 = 10080
    const PCOL = [2800, 1000, 1000, 1000, 800, 1280, 1560, 640];
    const PHDRS = ["Product", "Dist. Cases", "Retail Cases", "Total Cases", "ABV %", "Proof Gallons", "Excise Tax", "Per Bottle"];

    children.push(fixedTable({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({ tableHeader: true, children: PHDRS.map((h, i) => new TableCell({
          width: { size: PCOL[i], type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
          borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
          margins: PAD,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [r(h, true, 17)], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })],
        })) }),
        ...ebp.rows.map((row, ri) => {
          const active = row.totalCases > 0;
          return new TableRow({ children: PHDRS.map((_, i) => {
            const vals = [
              row.name,
              active ? String(row.distCases)         : "—",
              active ? String(row.retailCases)        : "—",
              active ? String(row.totalCases)         : "—",
              `${row.abv.toFixed(1)}%`,
              active ? row.proofGallons.toFixed(4)    : "—",
              active ? money(row.exciseTax)           : "—",
              active ? `$${row.perBottle.toFixed(4)}` : "—",
            ];
            return new TableCell({
              width: { size: PCOL[i], type: WidthType.DXA },
              borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
              margins: PAD,
              shading: !active ? { type: ShadingType.SOLID, color: LGRAY, fill: LGRAY } : ri % 2 === 1 ? { type: ShadingType.SOLID, color: "FAFAFA", fill: "FAFAFA" } : undefined,
              children: [new Paragraph({ children: [r(vals[i], false, 18, false, active ? BLACK : "AAAAAA")], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })],
            });
          }) });
        }),
        new TableRow({ children: ["TOTALS", String(ebp.totalDistCases), String(ebp.totalRetailCases), String(ebp.totalCases), "", ebp.totalProofGallons.toFixed(4), money(ebp.totalExciseTax), ""].map((v, i) => new TableCell({
          width: { size: PCOL[i], type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: HGRAY, fill: HGRAY },
          borders: { top: DBL, bottom: THIN, left: THIN, right: THIN },
          margins: PAD,
          children: [new Paragraph({ children: [r(v, true, 18)], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })],
        })) }),
      ],
    }));
    children.push(
      new Paragraph({ children: [r("Formula: Cases × 1.19 gal/case × (ABV% × 2 ÷ 100) = Proof Gallons  ·  Rate: $2.70/PG (Craft Tier 1 — IRC §5001(c)(1))  ·  Per Bottle = Excise Tax ÷ 6", false, 16, true, "777777")], spacing: { before: 50, after: 80 } }),
    );
  }

  children.push(
    new Paragraph({
      children: [r(`Attachment  ·  TTB Form 5000.24  ·  ${periodLabel(data.month)}  ·  ${data.proprietorName}  ·  Generated by Distillr Software`, false, 14, true, "AAAAAA")],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" } },
      spacing: { before: 40 },
    }),
  );

  const doc = new Document({
    creator: "Distillr Software",
    title: `TTB 5000.24 — ${data.proprietorName} — ${periodLabel(data.month)}`,
    sections: [{
      properties: { page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `TTB_5000_24_${data.proprietorName.replace(/\s+/g, "_")}_${data.month}.docx`);
}
