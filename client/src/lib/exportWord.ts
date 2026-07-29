// Word document generation for official TTB forms
// Lazy-loads docx to keep initial bundle small

// ─── Shared types ────────────────────────────────────────────────────────────

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
      spiritType: string;
      spiritClass: string;
      batchCount: number;
      proofGallons: number;
      batchCodes: string[];
    }>;
    deposited_by_spirit?: Array<{
      spiritType: string;
      spiritClass: string;
      barrelCount: number;
      wineGallons: number;
      proofGallons: number;
      avgFillProof: number;
      fillNumbers: string;
    }>;
    processed_by_spirit?: Array<{
      spiritType: string;
      spiritClass: string;
      batchCount: number;
      proofGallons: number;
      avgBottlingProof: number;
      cases750: number;
      cases1000: number;
      cases1750: number;
      totalCases: number;
      exciseTaxDue: number;
      lotNumbers: string[];
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
      key: string;
      name: string;
      abv: number;
      distCases: number;
      retailCases: number;
      totalCases: number;
      proofGallons: number;
      exciseTax: number;
      perBottle: number;
    }>;
    totalDistCases: number;
    totalRetailCases: number;
    totalCases: number;
    totalProofGallons: number;
    totalExciseTax: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodLabel(month: string): string {
  if (!month) return "—";
  return new Date(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
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

function pg(n: number | undefined): string {
  return (n ?? 0).toFixed(2);
}

function money(n: number | undefined): string {
  return `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─── TTB 5110.40 — Distiller's Monthly Report of Production Operations ────────

export async function export5110Word(data: WordOperationsData): Promise<void> {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, BorderStyle, WidthType, HeadingLevel,
    ShadingType, VerticalAlign,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const s = data.summary;
  const { start, end } = periodRange(data.month);
  const GRAY = "D9D9D9";
  const DARK = "2B1A0E";
  const GOLD = "C9A227";
  const THIN = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;
  const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;

  function hdr(text: string, size = 24, bold = true, color = "000000") {
    return new Paragraph({
      children: [new TextRun({ text, bold, size, color, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    });
  }

  function label(text: string, value = "", bold = false) {
    return new Paragraph({
      children: [
        new TextRun({ text: `${text}  `, bold: true, size: 18, font: "Times New Roman" }),
        new TextRun({ text: value || "_______________________________________________", size: 18, bold, font: "Times New Roman" }),
      ],
      spacing: { after: 80 },
    });
  }

  function sectionHeader(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      shading: { type: ShadingType.SOLID, color: GRAY, fill: GRAY },
    });
  }

  function makeTable(headers: string[], rows: string[][], colWidths: number[]) {
    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map((h, i) =>
        new TableCell({
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: GRAY, fill: GRAY },
          borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [new TextRun({ text: h, bold: true, size: 16, font: "Times New Roman" })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
            }),
          ],
        })
      ),
    });

    const dataRows = rows.map((row, ri) =>
      new TableRow({
        children: row.map((cell, ci) => {
          const isNum = ci > 0;
          return new TableCell({
            width: { size: colWidths[ci], type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            shading: ri % 2 === 1 && isNum
              ? { type: ShadingType.SOLID, color: "F0F0F0", fill: "F0F0F0" }
              : undefined,
            children: [
              new Paragraph({
                children: [new TextRun({ text: cell || "—", size: 17, font: "Times New Roman" })],
                alignment: isNum ? AlignmentType.RIGHT : AlignmentType.LEFT,
                spacing: { before: 30, after: 30 },
                indent: isNum ? undefined : { left: 60 },
              }),
            ],
          });
        }),
      })
    );

    return new Table({ rows: [headerRow, ...dataRows], width: { size: 9200, type: WidthType.DXA } });
  }

  function totalsRow(label: string, values: string[], colWidths: number[]) {
    return new TableRow({
      children: [label, ...values].map((v, i) =>
        new TableCell({
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" },
          borders: { top: { style: BorderStyle.THICK, size: 8, color: DARK }, bottom: THIN, left: THIN, right: THIN },
          children: [
            new Paragraph({
              children: [new TextRun({ text: v, bold: true, size: 18, font: "Times New Roman" })],
              alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              indent: i === 0 ? { left: 60 } : undefined,
            }),
          ],
        })
      ),
    });
  }

  // ── Document children ────────────────────────────────────────────────────

  const children = [];

  // Header
  children.push(
    new Paragraph({ children: [new TextRun({ text: "OMB No. 1513-0003", size: 16, font: "Times New Roman" })], alignment: AlignmentType.RIGHT, spacing: { after: 20 } }),
    hdr("DEPARTMENT OF THE TREASURY", 22),
    hdr("ALCOHOL AND TOBACCO TAX AND TRADE BUREAU (TTB)", 18),
    hdr("DISTILLED SPIRITS PLANT", 24, true, DARK),
    hdr("MONTHLY REPORT OF PRODUCTION OPERATIONS", 22, true, DARK),
    hdr("TTB Form 5110.40", 18, false, "737373"),
    new Paragraph({ children: [], spacing: { after: 80 } }),
  );

  // Identification block
  children.push(
    label("Name of Proprietor:", data.proprietorName),
    label("DSP Permit Number:", data.dspNumber ?? ""),
    label("Address:", data.address ?? ""),
    label("Reporting Period:", periodLabel(data.month)),
    label("Period Beginning:", start),
    label("Period Ending:", end),
    new Paragraph({ children: [], spacing: { after: 120 } }),
  );

  // ── PART I: Spirits Produced ─────────────────────────────────────────────
  children.push(sectionHeader("PART I — SPIRITS PRODUCED (By Distillation Date)"));

  const producedRows: string[][] = (s?.produced_by_spirit ?? []).map(r => [
    capitalize(r.spiritType),
    capitalize(r.spiritClass) || "—",
    String(r.batchCount),
    (r.batchCodes ?? []).join(", ") || "—",
    pg(r.proofGallons),
  ]);
  if (producedRows.length === 0) producedRows.push(["No spirits produced in this period.", "", "", "", ""]);

  const part1Table = makeTable(
    ["Spirit Type", "Class/Type", "Batches", "Batch Codes", "Proof Gallons"],
    producedRows,
    [1800, 1400, 900, 2800, 1400],
  );
  // Add totals row
  const p1Total = new TableRow({
    children: [
      { label: `TOTAL (${s?.prod_batch_count ?? 0} batches)`, width: 1800 + 1400 + 900 + 2800 },
      { label: pg(s?.total_produced), width: 1400 },
    ].map(({ label: lbl, width }, i) =>
      new TableCell({
        width: { size: width, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" },
        borders: { top: { style: BorderStyle.THICK, size: 8, color: "000000" }, bottom: THIN, left: THIN, right: THIN },
        columnSpan: i === 0 ? 4 : 1,
        children: [new Paragraph({
          children: [new TextRun({ text: lbl, bold: true, size: 18, font: "Times New Roman" })],
          alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
          spacing: { before: 40, after: 40 },
          indent: i === 0 ? { left: 60 } : undefined,
        })],
      })
    ),
  });
  (part1Table as any).root[1].push(p1Total);
  children.push(part1Table, new Paragraph({ children: [], spacing: { after: 120 } }));

  // ── PART II: Spirits Deposited to Bond ───────────────────────────────────
  children.push(sectionHeader("PART II — SPIRITS DEPOSITED TO BOND (By Fill Date)"));

  const depositedRows: string[][] = (s?.deposited_by_spirit ?? []).map(r => [
    capitalize(r.spiritType),
    capitalize(r.spiritClass) || "—",
    r.fillNumbers || "—",
    String(r.barrelCount),
    pg(r.wineGallons),
    `${(r.avgFillProof ?? 0).toFixed(1)}°`,
    pg(r.proofGallons),
  ]);
  if (depositedRows.length === 0) depositedRows.push(["No spirits deposited in this period.", "", "", "", "", "", ""]);

  const part2Table = makeTable(
    ["Spirit Type", "Class", "Fill Numbers", "Barrels", "Wine Gal.", "Avg Proof", "Proof Gallons"],
    depositedRows,
    [1400, 1100, 2200, 700, 1000, 900, 1200],
  );
  children.push(part2Table, new Paragraph({ children: [], spacing: { after: 120 } }));

  // ── PART III: Bonded Storage Balance ─────────────────────────────────────
  children.push(sectionHeader("PART III — BONDED STORAGE BALANCE (Proof Gallons)"));

  const ledgerItems = [
    ["1. On hand beginning of this report period", pg(s?.beginning_bond_balance)],
    ["2. Spirits deposited to bond (Part II)", pg(s?.total_deposited)],
    ["3. Spirits processed / removed from bond (Part IV)", `(${pg(s?.total_processed)})`],
    ["4. Losses (Angel's Share, spillage, etc.)", `(${pg(s?.period_losses_pg)})`],
    ["5. On hand end of this report period", pg(s?.ending_bond_balance)],
  ];

  const ledgerTable = new Table({
    width: { size: 9200, type: WidthType.DXA },
    rows: ledgerItems.map(([desc, val], i) => {
      const isTotal = i === ledgerItems.length - 1;
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 7200, type: WidthType.DXA },
            shading: isTotal ? { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" } : undefined,
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [new Paragraph({
              children: [new TextRun({ text: desc, bold: isTotal, size: 18, font: "Times New Roman" })],
              spacing: { before: 50, after: 50 }, indent: { left: 120 },
            })],
          }),
          new TableCell({
            width: { size: 2000, type: WidthType.DXA },
            shading: isTotal ? { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" } : undefined,
            borders: { top: isTotal ? { style: BorderStyle.DOUBLE, size: 8, color: "000000" } : THIN, bottom: THIN, left: THIN, right: THIN },
            children: [new Paragraph({
              children: [new TextRun({ text: val, bold: isTotal, size: 18, font: "Times New Roman", color: isTotal ? DARK : "000000" })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 50, after: 50 },
            })],
          }),
        ],
      });
    }),
  });
  children.push(ledgerTable);

  // Current bond snapshot
  children.push(
    new Paragraph({ children: [], spacing: { after: 60 } }),
    new Paragraph({
      children: [new TextRun({ text: `Current Warehouse Snapshot (Aging Barrels as of report date):  ${s?.barrels_in_bond_count ?? 0} barrels · ${pg(s?.barrels_in_bond_wg)} WG · ${pg(s?.barrels_in_bond_pg)} PG in bond`, size: 17, italics: true, font: "Times New Roman" })],
      spacing: { after: 120 },
    }),
  );

  // ── PART IV: Spirits Processed ───────────────────────────────────────────
  children.push(sectionHeader("PART IV — SPIRITS PROCESSED / BOTTLED (By Bottling Date)"));

  const processedRows: string[][] = (s?.processed_by_spirit ?? []).map(r => [
    capitalize(r.spiritType),
    capitalize(r.spiritClass) || "—",
    (r.lotNumbers ?? []).join(", ") || "—",
    `${(r.avgBottlingProof ?? 0).toFixed(1)}°`,
    String(r.cases750 || "—"),
    String(r.cases1000 || "—"),
    String(r.cases1750 || "—"),
    String(r.totalCases),
    pg(r.proofGallons),
    money(r.exciseTaxDue),
  ]);
  if (processedRows.length === 0) processedRows.push(["No spirits processed in this period.", "", "", "", "", "", "", "", "", ""]);

  const part4Table = makeTable(
    ["Spirit Type", "Class", "Lot Numbers", "Proof", "750mL cs", "1L cs", "1.75L cs", "Total cs", "PG Removed", "Excise Tax"],
    processedRows,
    [1100, 900, 1400, 700, 750, 700, 750, 750, 900, 1150],
  );
  children.push(part4Table, new Paragraph({ children: [], spacing: { after: 60 } }));

  // Part IV totals
  const p4Totals = [
    s?.total_cases_750 ?? 0, s?.total_cases_1000 ?? 0, s?.total_cases_1750 ?? 0,
    s?.grand_total_cases ?? 0, s?.total_processed ?? 0, s?.total_excise_tax ?? 0,
  ];
  children.push(new Paragraph({
    children: [
      new TextRun({ text: `Part IV Totals — `, bold: true, size: 18, font: "Times New Roman" }),
      new TextRun({ text: `PG Processed: ${pg(s?.total_processed)}   ·   Total Cases: ${s?.grand_total_cases ?? 0}   ·   Excise Tax: ${money(s?.total_excise_tax)}`, size: 18, font: "Times New Roman" }),
    ],
    spacing: { after: 200 },
    shading: { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" },
    indent: { left: 120, right: 120 },
  }));

  // Signature block
  children.push(
    new Paragraph({ children: [new TextRun({ text: "CERTIFICATION", bold: true, size: 20, font: "Times New Roman" })], spacing: { before: 160, after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "I certify that to the best of my knowledge and belief, the statements contained in this report are true, correct, and complete.", size: 17, italics: true, font: "Times New Roman" })], spacing: { after: 160 } }),
    new Paragraph({
      children: [
        new TextRun({ text: "Signature: _______________________________________________   ", size: 18, font: "Times New Roman" }),
        new TextRun({ text: "Date: _______________________", size: 18, font: "Times New Roman" }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Title: _______________________________________________   DSP: ${data.dspNumber ?? "____________________"}`, size: 18, font: "Times New Roman" })],
      spacing: { after: 80 },
    }),
    new Paragraph({ children: [new TextRun({ text: `TTB Form 5110.40   ·   ${periodLabel(data.month)}   ·   ${data.proprietorName}`, size: 16, italics: true, color: "737373", font: "Times New Roman" })], alignment: AlignmentType.CENTER, spacing: { before: 120 } }),
  );

  const doc = new Document({
    creator: "Distillr",
    title: `TTB 5110.40 — ${data.proprietorName} — ${periodLabel(data.month)}`,
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `TTB_5110_40_${data.proprietorName.replace(/\s+/g, "_")}_${data.month}.docx`);
}

// ─── TTB 5000.24 — Excise Tax Return ─────────────────────────────────────────

export async function export5000Word(data: WordExciseData): Promise<void> {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const ebp = data.exciseByProduct;
  const { start, end } = periodRange(data.month);
  const due = dueDate(data.month);
  const GRAY = "D9D9D9";
  const DARK = "2B1A0E";
  const GOLD = "C9A227";
  const THIN = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;
  const DBL  = { style: BorderStyle.DOUBLE, size: 8, color: "000000" } as const;

  const children = [];

  // ── Header ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [new TextRun({ text: "OMB No. 1513-0083", size: 16, font: "Times New Roman" })], alignment: AlignmentType.RIGHT, spacing: { after: 20 } }),
    new Paragraph({ children: [new TextRun({ text: "DEPARTMENT OF THE TREASURY", bold: true, size: 20, font: "Times New Roman" })], alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
    new Paragraph({ children: [new TextRun({ text: "ALCOHOL AND TOBACCO TAX AND TRADE BUREAU (TTB)", size: 17, font: "Times New Roman" })], alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
    new Paragraph({ children: [new TextRun({ text: "EXCISE TAX RETURN", bold: true, size: 28, font: "Times New Roman", color: DARK })], alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
    new Paragraph({ children: [new TextRun({ text: "TTB Form 5000.24  ·  (Distilled Spirits)", size: 17, italics: true, font: "Times New Roman", color: "737373" })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
  );

  // ── Section 1: Filing Information ────────────────────────────────────────
  const filingTable = new Table({
    width: { size: 9200, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          ...[
            { label: "Serial Number / Reference", value: `${data.dspNumber ?? "N/A"}-${data.month}` },
            { label: "Amount of Payment", value: money(ebp?.totalExciseTax) },
          ].map(({ label, value }) => new TableCell({
            width: { size: 4600, type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [
              new Paragraph({ children: [new TextRun({ text: label, size: 16, italics: true, font: "Times New Roman", color: "737373" })], spacing: { before: 30 } }),
              new Paragraph({ children: [new TextRun({ text: value, bold: true, size: 20, font: "Times New Roman" })], spacing: { after: 40 } }),
            ],
          })),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4600, type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Form of Payment", size: 16, italics: true, font: "Times New Roman", color: "737373" })], spacing: { before: 30 } }),
              new Paragraph({ children: [new TextRun({ text: "☑  EFT (Electronic Funds Transfer) via Pay.gov", size: 18, font: "Times New Roman" })], spacing: { after: 40 } }),
            ],
          }),
          new TableCell({
            width: { size: 4600, type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Return Covers", size: 16, italics: true, font: "Times New Roman", color: "737373" })], spacing: { before: 30 } }),
              new Paragraph({ children: [new TextRun({ text: `☑  Period  Beginning: ${start}  —  Ending: ${end}`, size: 18, font: "Times New Roman" })], spacing: { after: 40 } }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4600, type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Date Products to be Removed", size: 16, italics: true, font: "Times New Roman", color: "737373" })], spacing: { before: 30 } }),
              new Paragraph({ children: [new TextRun({ text: due, size: 18, font: "Times New Roman" })], spacing: { after: 40 } }),
            ],
          }),
          new TableCell({
            width: { size: 4600, type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Employer Identification Number (EIN)", size: 16, italics: true, font: "Times New Roman", color: "737373" })], spacing: { before: 30 } }),
              new Paragraph({ children: [new TextRun({ text: data.ein ?? "___________________________", size: 18, font: "Times New Roman" })], spacing: { after: 40 } }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 9200, type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Plant, Registry, or Permit Number", size: 16, italics: true, font: "Times New Roman", color: "737373" })], spacing: { before: 30 } }),
              new Paragraph({ children: [new TextRun({ text: data.dspNumber ?? "DSP Number not configured — set in Settings", bold: true, size: 18, font: "Times New Roman" })], spacing: { after: 40 } }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 9200, type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Name and Address of Registrant", size: 16, italics: true, font: "Times New Roman", color: "737373" })], spacing: { before: 30 } }),
              new Paragraph({ children: [new TextRun({ text: `${data.proprietorName}${data.address ? `  ·  ${data.address}` : ""}`, bold: true, size: 18, font: "Times New Roman" })], spacing: { after: 40 } }),
            ],
          }),
        ],
      }),
    ],
  });
  children.push(filingTable, new Paragraph({ children: [], spacing: { after: 120 } }));

  // ── Calculation of Tax Due ────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "CALCULATION OF TAX DUE (Schedule A) — Distilled Spirits", bold: true, size: 20, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: GRAY, fill: GRAY },
      spacing: { before: 60, after: 60 },
    }),
  );

  // Product-by-product table matching the spreadsheet
  const productRows = (ebp?.rows ?? []).map(r => [
    r.name,
    String(r.distCases || (r.totalCases > 0 ? "0" : "—")),
    String(r.retailCases || (r.totalCases > 0 ? "0" : "—")),
    String(r.totalCases || "—"),
    `${r.abv.toFixed(1)}%`,
    r.totalCases > 0 ? r.proofGallons.toFixed(4) : "—",
    r.totalCases > 0 ? money(r.exciseTax) : "—",
    r.totalCases > 0 ? `$${r.perBottle.toFixed(4)}` : "—",
  ]);
  if (productRows.length === 0) productRows.push(["No product data for this period.", "", "", "", "", "", "", ""]);

  const productTable = new Table({
    width: { size: 9200, type: WidthType.DXA },
    rows: [
      // Header
      new TableRow({
        tableHeader: true,
        children: ["PRODUCT", "DIST. CASES", "RETAIL CASES", "TOTAL CASES", "ABV %", "PROOF GAL.", "EXCISE TAX", "PER BOTTLE"].map((h, i) =>
          new TableCell({
            width: { size: [2000, 900, 1000, 950, 700, 1000, 1200, 1050][i], type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: DARK, fill: DARK },
            borders: { top: THIN, bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD }, left: THIN, right: THIN },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              children: [new TextRun({ text: h, bold: true, size: 15, font: "Times New Roman", color: "FFFFFF" })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
            })],
          })
        ),
      }),
      // Data rows
      ...productRows.map((row, ri) => {
        const active = (ebp?.rows[ri]?.totalCases ?? 0) > 0;
        return new TableRow({
          children: row.map((cell, ci) =>
            new TableCell({
              width: { size: [2000, 900, 1000, 950, 700, 1000, 1200, 1050][ci], type: WidthType.DXA },
              borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
              shading: !active ? { type: ShadingType.SOLID, color: "F8F8F8", fill: "F8F8F8" } : ri % 2 === 1 ? { type: ShadingType.SOLID, color: "F5F0EB", fill: "F5F0EB" } : undefined,
              children: [new Paragraph({
                children: [new TextRun({ text: cell, size: 16, font: "Times New Roman", color: active ? "000000" : "AAAAAA" })],
                alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                spacing: { before: 30, after: 30 },
                indent: ci === 0 ? { left: 60 } : undefined,
              })],
            })
          ),
        });
      }),
      // Totals row
      new TableRow({
        children: [
          "TOTALS",
          String(ebp?.totalDistCases ?? 0),
          String(ebp?.totalRetailCases ?? 0),
          String(ebp?.totalCases ?? 0),
          "",
          (ebp?.totalProofGallons ?? 0).toFixed(4),
          money(ebp?.totalExciseTax),
          "",
        ].map((v, i) =>
          new TableCell({
            width: { size: [2000, 900, 1000, 950, 700, 1000, 1200, 1050][i], type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" },
            borders: { top: { style: BorderStyle.THICK, size: 8, color: DARK }, bottom: THIN, left: THIN, right: THIN },
            children: [new Paragraph({
              children: [new TextRun({ text: v, bold: true, size: 17, font: "Times New Roman", color: i === 6 ? GOLD : DARK })],
              alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              indent: i === 0 ? { left: 60 } : undefined,
            })],
          })
        ),
      }),
    ],
  });

  children.push(productTable);
  children.push(
    new Paragraph({ children: [new TextRun({ text: "Formula: Cases × 1.19 gal/case × (ABV × 2) ÷ 100 = Proof Gallons  ·  Rate: $2.70/PG (Craft Tier 1, IRC §5001(c)(1))", size: 16, italics: true, font: "Times New Roman", color: "999999" })], spacing: { before: 60, after: 120 } }),
  );

  // ── Lines 9 – 22 (official form structure) ───────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "SUMMARY OF TAX DUE", bold: true, size: 20, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: GRAY, fill: GRAY },
      spacing: { before: 60, after: 60 },
    }),
  );

  const summaryLines: [string, string][] = [
    ["9. Distilled Spirits (total from Schedule A above)", money(ebp?.totalExciseTax)],
    ["10. Wine", "$0.00"],
    ["11. Beer", "$0.00"],
    ["12. Cigars", "$0.00"],
    ["13. Cigarettes", "$0.00"],
    ["14. Chewing Tobacco and/or Snuff", "$0.00"],
    ["15. Pipe Tobacco and Roll-Your-Own Tobacco", "$0.00"],
    ["16. TOTAL TAX LIABILITY (Sum of lines 9 – 15)", money(ebp?.totalExciseTax)],
    ["17. (Reserved)", ""],
    ["18. Total adjustments (from Schedule A, line 28)", "$0.00"],
    ["19. TOTAL ADJUSTED TAX DUE (Line 16 + Line 18)", money(ebp?.totalExciseTax)],
    ["20. Amount to be paid with return (Line 19 – Line 20)", money(ebp?.totalExciseTax)],
    ["21. NET AMOUNT DUE", money(ebp?.totalExciseTax)],
  ];

  const summaryTable = new Table({
    width: { size: 9200, type: WidthType.DXA },
    rows: summaryLines.map(([desc, val], i) => {
      const isTotal = [15, 18, 20].includes(i);
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 7200, type: WidthType.DXA },
            shading: isTotal ? { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" } : undefined,
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [new Paragraph({
              children: [new TextRun({ text: desc, bold: isTotal, size: 18, font: "Times New Roman" })],
              spacing: { before: 40, after: 40 },
              indent: { left: 120 },
            })],
          }),
          new TableCell({
            width: { size: 2000, type: WidthType.DXA },
            shading: isTotal ? { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" } : undefined,
            borders: { top: isTotal ? DBL : THIN, bottom: THIN, left: THIN, right: THIN },
            children: [new Paragraph({
              children: [new TextRun({ text: val, bold: isTotal, size: isTotal ? 20 : 18, font: "Times New Roman", color: isTotal ? GOLD : "000000" })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
            })],
          }),
        ],
      });
    }),
  });
  children.push(summaryTable, new Paragraph({ children: [], spacing: { after: 120 } }));

  // ── Schedules A & B ──────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "SCHEDULE A — ADJUSTMENTS INCREASING AMOUNT DUE", bold: true, size: 18, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: GRAY, fill: GRAY },
      spacing: { before: 40, after: 60 },
    }),
  );

  const adjustTable = (label: string) => new Table({
    width: { size: 9200, type: WidthType.DXA },
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["Explanation of Individual Errors or Transactions", "Product", "(a) Tax", "(b) Interest", "(c) Penalty"].map((h, i) =>
          new TableCell({
            width: { size: [3800, 1600, 1200, 1200, 1200][i], type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: GRAY, fill: GRAY },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, font: "Times New Roman" })], alignment: AlignmentType.CENTER, spacing: { before: 30, after: 30 } })],
          })
        ),
      }),
      ...[1, 2, 3].map(() => new TableRow({
        children: [3800, 1600, 1200, 1200, 1200].map((w) =>
          new TableCell({
            width: { size: w, type: WidthType.DXA },
            borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
            children: [new Paragraph({ children: [new TextRun({ text: "", size: 16 })], spacing: { before: 40, after: 40 } })],
          })
        ),
      })),
      new TableRow({
        children: [
          new TableCell({ width: { size: 3800, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" }, children: [new Paragraph({ children: [new TextRun({ text: `Subtotals of ${label}`, bold: true, size: 16, font: "Times New Roman" })], spacing: { before: 30, after: 30 }, indent: { left: 60 } })] }),
          new TableCell({ width: { size: 1600, type: WidthType.DXA }, borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, shading: { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" }, children: [new Paragraph({ children: [new TextRun({ text: "", size: 16 })], spacing: { before: 30, after: 30 } })] }),
          ...["$0.00", "$0.00", "$0.00"].map((v) => new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders: { top: { style: BorderStyle.DOUBLE, size: 6, color: "000000" }, bottom: THIN, left: THIN, right: THIN }, shading: { type: ShadingType.SOLID, color: "E8E0D4", fill: "E8E0D4" }, children: [new Paragraph({ children: [new TextRun({ text: v, bold: true, size: 16, font: "Times New Roman" })], alignment: AlignmentType.RIGHT, spacing: { before: 30, after: 30 } })] })),
        ],
      }),
    ],
  });

  children.push(adjustTable("Columns (a), (b), (c)"), new Paragraph({ children: [], spacing: { after: 60 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "SCHEDULE B — ADJUSTMENTS DECREASING AMOUNT DUE", bold: true, size: 18, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: GRAY, fill: GRAY },
      spacing: { before: 40, after: 60 },
    }),
    adjustTable("Columns (a), (b)"),
    new Paragraph({ children: [], spacing: { after: 120 } }),
  );

  // ── Signature ────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [new TextRun({ text: "CERTIFICATION", bold: true, size: 20, font: "Times New Roman" })], spacing: { before: 80, after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Under penalties of perjury, I declare that I have examined this return, and to the best of my knowledge and belief, it is true, correct, and complete.", size: 17, italics: true, font: "Times New Roman" })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: "Signature: _______________________________________________   Date: _______________________", size: 18, font: "Times New Roman" })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `Title: _________________________________   EIN: ${data.ein ?? "_______________"}   DSP: ${data.dspNumber ?? "_______________"}`, size: 18, font: "Times New Roman" })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `TTB Form 5000.24  ·  ${periodLabel(data.month)}  ·  ${data.proprietorName}`, size: 16, italics: true, color: "737373", font: "Times New Roman" })], alignment: AlignmentType.CENTER, spacing: { before: 120 } }),
  );

  const doc = new Document({
    creator: "Distillr",
    title: `TTB 5000.24 — ${data.proprietorName} — ${periodLabel(data.month)}`,
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `TTB_5000_24_${data.proprietorName.replace(/\s+/g, "_")}_${data.month}.docx`);
}
