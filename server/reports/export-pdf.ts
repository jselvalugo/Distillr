import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { ReportColumn, ReportDocument, ReportRow, ReportSection } from "../../shared/report-types";
import { formatCell, formatDate, isNumericFormat } from "./format";
import { DISTILLR_MARK_PNG_BASE64 } from "./brand-mark";
import { COMPLIANCE_DISCLAIMER } from "../../shared/compliance-disclaimer";

// ── Page geometry (US Letter, landscape) ───────────────────────────────────
const PAGE_W = 792;
const PAGE_H = 612;
const MARGIN_X = 40;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 44;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// ── Palette ────────────────────────────────────────────────────────────────
const INK = rgb(0.06, 0.06, 0.07);
const INK_SOFT = rgb(0.36, 0.36, 0.39);
const INK_MUTED = rgb(0.58, 0.58, 0.62);
const RULE = rgb(0.86, 0.86, 0.88);
const RULE_SOFT = rgb(0.93, 0.93, 0.94);
const FILL_HEAD = rgb(0.955, 0.955, 0.962);
const FILL_ZEBRA = rgb(0.985, 0.985, 0.988);
const WARN_BG = rgb(1, 0.97, 0.9);
const WARN_INK = rgb(0.55, 0.36, 0.05);
const WHITE = rgb(1, 1, 1);

function hexToRgb(hex: string | null | undefined, fallback: RGB): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return fallback;
  const v = parseInt(m[1], 16);
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

/** pdf-lib standard fonts only know WinAnsi; swap or drop anything else. */
function safe(text: string): string {
  return text
    .replace(/−/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…]/g, "");
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

class Layout {
  readonly pdf: PDFDocument;
  readonly fonts: Fonts;
  readonly brand: RGB;
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = PAGE_H - MARGIN_TOP;
  logo: PDFImage | null = null;
  distillrMark: PDFImage | null = null;

  constructor(pdf: PDFDocument, fonts: Fonts, brand: RGB) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.brand = brand;
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = PAGE_H - MARGIN_TOP;
  }

  ensure(height: number): boolean {
    if (this.y - height < MARGIN_BOTTOM) {
      this.newPage();
      return true;
    }
    return false;
  }

  width(text: string, font: PDFFont, size: number): number {
    return font.widthOfTextAtSize(safe(text), size);
  }

  text(text: string, x: number, y: number, opts: { font?: PDFFont; size?: number; color?: RGB; align?: "left" | "right" | "center"; maxWidth?: number } = {}) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 9;
    let s = safe(text);
    if (opts.maxWidth != null) s = this.truncate(s, font, size, opts.maxWidth);
    const w = font.widthOfTextAtSize(s, size);
    let dx = x;
    if (opts.align === "right") dx = x - w;
    else if (opts.align === "center") dx = x - w / 2;
    this.page.drawText(s, { x: dx, y, size, font, color: opts.color ?? INK });
  }

  truncate(s: string, font: PDFFont, size: number, maxWidth: number): string {
    if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
    let out = s;
    while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > maxWidth) out = out.slice(0, -1);
    return out + "…";
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        // Hard-break words longer than the column.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
              lines.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  rule(x1: number, x2: number, y: number, color: RGB = RULE, thickness = 0.6) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  rect(x: number, y: number, w: number, h: number, color: RGB) {
    this.page.drawRectangle({ x, y, width: w, height: h, color });
  }

  paragraph(text: string, opts: { font?: PDFFont; size?: number; color?: RGB; x?: number; width?: number; lineGap?: number } = {}) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 8.5;
    const x = opts.x ?? MARGIN_X;
    const width = opts.width ?? CONTENT_W;
    const lh = size * 1.35 + (opts.lineGap ?? 0);
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(lh);
      this.y -= lh;
      this.text(line, x, this.y, { font, size, color: opts.color });
    }
  }
}

// ── Blocks ─────────────────────────────────────────────────────────────────

function drawHeader(L: Layout, doc: ReportDocument) {
  const { bold, regular } = L.fonts;
  const top = L.y;
  let leftX = MARGIN_X;

  if (L.logo) {
    const maxH = 34;
    const scale = Math.min(maxH / L.logo.height, 110 / L.logo.width);
    const w = L.logo.width * scale;
    const h = L.logo.height * scale;
    L.page.drawImage(L.logo, { x: MARGIN_X, y: top - h, width: w, height: h });
    leftX += w + 12;
  }

  L.text(doc.organization.name, leftX, top - 14, { font: bold, size: 15, maxWidth: 360 });
  const idBits = [
    doc.organization.dspNumber ? (/^dsp/i.test(doc.organization.dspNumber) ? doc.organization.dspNumber : `DSP ${doc.organization.dspNumber}`) : null,
    doc.organization.ein ? `EIN ${doc.organization.ein}` : null,
  ].filter(Boolean) as string[];
  if (idBits.length) L.text(idBits.join("  ·  "), leftX, top - 27, { size: 8.5, color: INK_SOFT });
  if (doc.organization.address) L.text(doc.organization.address, leftX, top - 38, { size: 8, color: INK_MUTED, maxWidth: 380 });

  const rightX = PAGE_W - MARGIN_X;
  L.text(doc.title, rightX, top - 16, { font: bold, size: 18, align: "right" });
  const sub = [doc.formReference, doc.period?.label ?? "Point-in-time snapshot"].filter(Boolean).join("  ·  ");
  L.text(sub, rightX, top - 30, { size: 9.5, color: INK_SOFT, align: "right" });
  L.text(`Generated ${formatDate(doc.generatedAt.slice(0, 10))}`, rightX, top - 41, { size: 8, color: INK_MUTED, align: "right" });

  L.y = top - 52;
  L.rect(MARGIN_X, L.y, CONTENT_W, 2.2, L.brand);
  L.y -= 14;
}

function drawWarnings(L: Layout, doc: ReportDocument) {
  if (!doc.warnings.length) return;
  const size = 8;
  const lines = doc.warnings.flatMap((w) => L.wrap(`•  ${w}`, L.fonts.regular, size, CONTENT_W - 20));
  const h = lines.length * size * 1.4 + 14;
  L.ensure(h);
  L.rect(MARGIN_X, L.y - h, CONTENT_W, h, WARN_BG);
  L.rect(MARGIN_X, L.y - h, 2.5, h, WARN_INK);
  let y = L.y - 11;
  L.text("Setup notes", MARGIN_X + 10, y, { font: L.fonts.bold, size: 7.5, color: WARN_INK });
  y -= 3;
  for (const line of lines) {
    y -= size * 1.4;
    L.text(line, MARGIN_X + 10, y, { size, color: WARN_INK });
  }
  L.y -= h + 12;
}

function drawKpis(L: Layout, doc: ReportDocument) {
  if (!doc.kpis.length) return;
  const n = doc.kpis.length;
  const gap = 10;
  const w = (CONTENT_W - gap * (n - 1)) / n;
  const h = 46;
  L.ensure(h + 16);
  const top = L.y;
  doc.kpis.forEach((kpi, i) => {
    const x = MARGIN_X + i * (w + gap);
    L.page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: RULE, borderWidth: 0.6, color: WHITE });
    L.rect(x, top - h, w, 1.8, L.brand);
    L.text(kpi.label.toUpperCase(), x + 10, top - 14, { size: 6.5, color: INK_MUTED, maxWidth: w - 20 });
    L.text(formatCell(kpi.value, kpi.format), x + 10, top - 31, { font: L.fonts.bold, size: 14, maxWidth: w - 20 });
    if (kpi.sub) L.text(kpi.sub, x + 10, top - 41, { size: 6.8, color: INK_SOFT, maxWidth: w - 20 });
  });
  L.y = top - h - 16;
}

function sectionHeading(L: Layout, section: ReportSection, continued = false) {
  const { bold, italic } = L.fonts;
  L.ensure(continued ? 40 : 96); // keep the heading with its first rows
  L.y -= 4;
  let x = MARGIN_X;
  if (section.tag) {
    L.page.drawCircle({ x: x + 7, y: L.y - 4, size: 7, color: L.brand });
    L.text(section.tag, x + 7, L.y - 6.4, { font: bold, size: 6.5, color: WHITE, align: "center" });
    x += 20;
  }
  L.text(section.title + (continued ? " (continued)" : ""), x, L.y - 8, { font: bold, size: 11 });
  L.y -= 15;
  if (section.description && !continued) {
    L.y += 2;
    L.paragraph(section.description, { font: italic, size: 8, color: INK_SOFT });
  }
  L.y -= 6;
}

function computeColumnWidths(L: Layout, columns: ReportColumn[], rows: ReportRow[], totals?: ReportRow): number[] {
  const size = 7.5;
  const pad = 12;
  const minW = 42;
  const naturals = columns.map((col) => {
    const samples = [...rows.slice(0, 200).map((r) => formatCell(r[col.key], col.format)), totals ? formatCell(totals[col.key], col.format) : ""];
    const longest = Math.max(0, ...samples.map((s) => L.width(s, col.key === columns[0].key ? L.fonts.bold : L.fonts.regular, size)));
    // Headers may wrap onto two lines; make sure the longest word still fits.
    const headWord = Math.max(...col.label.split(/\s+/).map((w) => L.width(w, L.fonts.bold, size - 0.5)));
    const headHalf = L.width(col.label, L.fonts.bold, size - 0.5) / 2 + 6;
    return Math.max(minW, headWord + pad, Math.min(Math.max(longest + pad, headHalf), isNumericFormat(col.format) ? 96 : 200));
  });
  const floors = columns.map((col) => Math.max(...col.label.split(/\s+/).map((w) => L.width(w, L.fonts.bold, size - 0.5))) + pad);
  const hinted = naturals.map((w, i) => Math.max(w * (columns[i].width ?? 1), floors[i]));
  const total = hinted.reduce((a, b) => a + b, 0);
  if (total <= CONTENT_W) {
    // Give spare room to text columns proportionally so tables fill the width.
    const spare = CONTENT_W - total;
    const textIdx = columns.map((c, i) => (isNumericFormat(c.format) ? -1 : i)).filter((i) => i >= 0);
    const pool = textIdx.length ? textIdx : columns.map((_, i) => i);
    const poolTotal = pool.reduce((a, i) => a + hinted[i], 0);
    return hinted.map((w, i) => (pool.includes(i) ? w + (spare * w) / poolTotal : w));
  }
  const scale = CONTENT_W / total;
  return hinted.map((w) => w * scale);
}

function drawTable(L: Layout, section: ReportSection) {
  const { columns, rows, totals } = section;
  const size = 7.5;
  const lineH = size * 1.32;
  const padX = 5;
  const padY = 3.5;
  const widths = computeColumnWidths(L, columns, rows, totals);
  const xs: number[] = [];
  let acc = MARGIN_X;
  for (const w of widths) {
    xs.push(acc);
    acc += w;
  }

  const headLines = columns.map((col, i) => L.wrap(col.label, L.fonts.bold, size - 0.5, widths[i] - padX * 2).slice(0, 2));
  const headRows = Math.max(1, ...headLines.map((l) => l.length));
  const drawHead = () => {
    const h = headRows * lineH + padY * 2 + 1;
    L.rect(MARGIN_X, L.y - h, CONTENT_W, h, FILL_HEAD);
    columns.forEach((col, i) => {
      const x = xs[i];
      const right = col.align === "right" || (col.align == null && isNumericFormat(col.format));
      const lines = headLines[i];
      lines.forEach((line, li) => {
        // Bottom-align header text so single-line labels sit level with the last line of wrapped ones.
        const y = L.y - padY - size - (headRows - lines.length + li) * lineH;
        L.text(line, right ? x + widths[i] - padX : col.align === "center" ? x + widths[i] / 2 : x + padX, y, {
          font: L.fonts.bold,
          size: size - 0.5,
          color: INK_SOFT,
          align: right ? "right" : col.align === "center" ? "center" : "left",
        });
      });
    });
    L.y -= h;
    L.rule(MARGIN_X, MARGIN_X + CONTENT_W, L.y, RULE, 0.8);
  };

  const drawRow = (row: ReportRow, opts: { zebra?: boolean; bold?: boolean; isTotal?: boolean }) => {
    const cells = columns.map((col, i) => {
      const value = opts.isTotal && row[col.key] == null ? "" : formatCell(row[col.key], col.format, { blank: opts.isTotal ? "" : "—" });
      const font = opts.bold || (i === 0 && !opts.isTotal) ? L.fonts.bold : L.fonts.regular;
      const lines = col.format === "list" || !isNumericFormat(col.format) ? L.wrap(value, font, size, widths[i] - padX * 2) : [safe(value)];
      return { lines: lines.slice(0, 6), font };
    });
    const nLines = Math.max(1, ...cells.map((c) => c.lines.length));
    const h = nLines * lineH + padY * 2;
    if (L.ensure(h)) {
      sectionHeading(L, section, true);
      drawHead();
    }
    if (opts.isTotal) {
      L.rule(MARGIN_X, MARGIN_X + CONTENT_W, L.y, INK, 0.9);
      L.rect(MARGIN_X, L.y - h, CONTENT_W, h, FILL_HEAD);
    } else if (opts.zebra) {
      L.rect(MARGIN_X, L.y - h, CONTENT_W, h, FILL_ZEBRA);
    }
    columns.forEach((col, i) => {
      const x = xs[i];
      const right = col.align === "right" || (col.align == null && isNumericFormat(col.format));
      const cell = cells[i];
      cell.lines.forEach((line, li) => {
        const y = L.y - padY - size - li * lineH;
        L.text(line, right ? x + widths[i] - padX : col.align === "center" ? x + widths[i] / 2 : x + padX, y, {
          font: cell.font,
          size,
          color: opts.isTotal ? INK : i === 0 ? INK : INK_SOFT,
          align: right ? "right" : col.align === "center" ? "center" : "left",
        });
      });
    });
    L.y -= h;
    if (!opts.isTotal) L.rule(MARGIN_X, MARGIN_X + CONTENT_W, L.y, RULE_SOFT, 0.4);
  };

  drawHead();
  rows.forEach((row, i) => drawRow(row, { zebra: i % 2 === 1 }));
  if (totals && rows.length) drawRow(totals, { bold: true, isTotal: true });
  L.y -= 6;
}

function drawFacts(L: Layout, section: ReportSection) {
  const facts = section.facts ?? [];
  const size = 8.5;
  const lh = size * 1.75;
  const gap = 24;

  // Split into groups (in first-seen order); ungrouped facts form one group.
  const groupNames: string[] = [];
  const groups: Record<string, typeof facts> = {};
  for (const f of facts) {
    const g = f.group ?? "";
    if (!groups[g]) {
      groups[g] = [];
      groupNames.push(g);
    }
    groups[g].push(f);
  }
  // Up to two groups side by side per band.
  for (let gi = 0; gi < groupNames.length; gi += 2) {
    const band = groupNames.slice(gi, gi + 2);
    const colW = (CONTENT_W - gap * (band.length - 1)) / band.length;
    const rowsNeeded = Math.max(...band.map((g) => groups[g].length));
    const titleH = band.some((g) => g) ? 16 : 0;
    L.ensure(rowsNeeded * lh + titleH + 10);
    const top = L.y;
    band.forEach((g, ci) => {
      const x = MARGIN_X + ci * (colW + gap);
      let y = top;
      if (g) {
        y -= 10;
        L.text(g.toUpperCase(), x, y, { font: L.fonts.bold, size: 6.8, color: INK_MUTED });
        y -= 6;
      }
      for (const f of groups[g]) {
        y -= lh;
        const font = f.emphasis ? L.fonts.bold : L.fonts.regular;
        const label = `${f.sign ? `${f.sign}  ` : ""}${f.label}`;
        const valueText = formatCell(f.value, f.format);
        const valueW = L.width(valueText, font, f.emphasis ? size + 1 : size);
        L.text(label, x, y, { font, size, color: f.emphasis ? INK : INK_SOFT, maxWidth: colW - valueW - 12 });
        L.text(valueText, x + colW, y, { font, size: f.emphasis ? size + 1 : size, align: "right" });
        L.rule(x, x + colW, y - 5, f.emphasis && f.sign === "=" ? INK : RULE_SOFT, f.emphasis && f.sign === "=" ? 0.8 : 0.4);
      }
    });
    L.y = top - titleH - rowsNeeded * lh - 10;
  }
}

function drawSection(L: Layout, section: ReportSection) {
  sectionHeading(L, section);
  if (section.facts?.length) drawFacts(L, section);
  if (section.columns.length) {
    if (section.rows.length) drawTable(L, section);
    else {
      L.paragraph(section.emptyHint ?? "No data for this period.", { font: L.fonts.italic, size: 8, color: INK_MUTED, x: MARGIN_X + 2 });
      L.y -= 6;
    }
  }
  for (const note of section.notes ?? []) {
    L.paragraph(note, { size: 7.5, color: INK_MUTED, x: MARGIN_X + 2 });
  }
  L.y -= 10;
}

function drawMethodology(L: Layout, doc: ReportDocument) {
  if (!doc.methodology.length) return;
  L.ensure(50);
  L.y -= 6;
  L.rule(MARGIN_X, MARGIN_X + CONTENT_W, L.y, RULE);
  L.y -= 14;
  L.text("How this report is calculated", MARGIN_X, L.y, { font: L.fonts.bold, size: 9 });
  L.y -= 4;
  for (const m of doc.methodology) L.paragraph(`•  ${m}`, { size: 7.8, color: INK_SOFT, x: MARGIN_X + 4, width: CONTENT_W - 4 });
}

function drawDisclaimer(L: Layout) {
  L.ensure(30);
  L.y -= 8;
  L.paragraph(COMPLIANCE_DISCLAIMER, { size: 7.5, color: INK_MUTED, x: MARGIN_X, width: CONTENT_W });
}

function drawFooters(L: Layout, doc: ReportDocument) {
  const total = L.pages.length;
  const left = [doc.organization.name, doc.title, doc.period?.label].filter(Boolean).join("  ·  ");
  L.pages.forEach((page, i) => {
    L.page = page;
    L.rule(MARGIN_X, MARGIN_X + CONTENT_W, MARGIN_BOTTOM - 14, RULE);
    L.text(left, MARGIN_X, MARGIN_BOTTOM - 26, { size: 7, color: INK_MUTED, maxWidth: 420 });
    const label = "Prepared with distillr";
    const labelW = L.width(label, L.fonts.regular, 7);
    const markH = 7.2;
    const markW = L.distillrMark ? (L.distillrMark.width / L.distillrMark.height) * markH : 0;
    const startX = PAGE_W / 2 - (labelW + (markW ? markW + 4 : 0)) / 2;
    if (L.distillrMark) L.page.drawImage(L.distillrMark, { x: startX, y: MARGIN_BOTTOM - 27, width: markW, height: markH });
    L.text(label, startX + (markW ? markW + 4 : 0), MARGIN_BOTTOM - 26, { size: 7, color: INK_MUTED });
    L.text(`Page ${i + 1} of ${total}`, PAGE_W - MARGIN_X, MARGIN_BOTTOM - 26, { size: 7, color: INK_MUTED, align: "right" });
  });
}

async function embedLogo(pdf: PDFDocument, dataUrl: string | null): Promise<PDFImage | null> {
  if (!dataUrl) return null;
  const m = /^data:(image\/(png|jpeg|jpg));base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[3], "base64");
    return m[2].toLowerCase() === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function renderReportPdf(doc: ReportDocument, options: { brandColor?: string | null } = {}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.title}${doc.period ? ` — ${doc.period.label}` : ""}`);
  pdf.setAuthor(doc.organization.name);
  pdf.setProducer("Distillr");
  pdf.setCreator("Distillr");
  pdf.setSubject(doc.subtitle);

  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  const L = new Layout(pdf, fonts, hexToRgb(options.brandColor, rgb(0.06, 0.11, 0.26)));
  L.logo = await embedLogo(pdf, doc.organization.logoDataUrl);
  try {
    L.distillrMark = await pdf.embedPng(Buffer.from(DISTILLR_MARK_PNG_BASE64, "base64"));
  } catch {
    L.distillrMark = null;
  }
  L.newPage();

  drawHeader(L, doc);
  drawWarnings(L, doc);
  drawKpis(L, doc);
  for (const section of doc.sections) drawSection(L, section);
  drawMethodology(L, doc);
  drawDisclaimer(L);
  drawFooters(L, doc);

  return Buffer.from(await pdf.save());
}
