import type { Express, NextFunction, Request, Response } from "express";
import { storage } from "../storage";
import { buildReport } from "./build";
import { REPORT_CATALOG, getCatalogEntry, isReportKind, resolvePeriod } from "./catalog";
import { renderReportCsv } from "./export-csv";
import { renderReportPdf } from "./export-pdf";
import { renderReportXlsx } from "./export-xlsx";
import { safeFilename } from "./format";

function requireSession(req: Request, res: Response): boolean {
  if (!req.session?.user) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  return true;
}

function rangeFromQuery(req: Request, kind: string) {
  const entry = getCatalogEntry(kind)!;
  if (!entry.takesPeriod) return resolvePeriod({ preset: "all-time" })!;
  const preset = typeof req.query.preset === "string" ? req.query.preset : null;
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  return resolvePeriod({ preset: preset ?? (from && to ? null : entry.defaultRange), from, to });
}

export function registerReportRoutes(app: Express) {
  /** The report catalog: what each report is for and which filters it takes. */
  app.get("/api/reports", (req, res) => {
    if (!requireSession(req, res)) return;
    res.json({ reports: REPORT_CATALOG });
  });

  /** Build a report document. ?preset=last-month | ?from=YYYY-MM-DD&to=YYYY-MM-DD */
  app.get("/api/reports/:kind", async (req, res, next: NextFunction) => {
    const { kind } = req.params;
    if (!isReportKind(kind)) return next(); // e.g. /api/reports/ttb is handled elsewhere
    if (!requireSession(req, res)) return;
    const range = rangeFromQuery(req, kind);
    if (!range) return res.status(400).json({ error: "Invalid period. Use preset=… or from=YYYY-MM-DD&to=YYYY-MM-DD." });
    try {
      res.setHeader("Cache-Control", "private, no-store");
      res.json(await buildReport(kind, range));
    } catch (err) {
      console.error(`[reports] ${kind} failed:`, err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Could not build the report" });
    }
  });

  /** Export the same document. ?format=pdf|xlsx|csv plus the same period params. */
  app.get("/api/reports/:kind/export", async (req, res, next: NextFunction) => {
    const { kind } = req.params;
    if (!isReportKind(kind)) return next();
    if (!requireSession(req, res)) return;
    const format = String(req.query.format ?? "pdf").toLowerCase();
    if (!["pdf", "xlsx", "csv"].includes(format)) return res.status(400).json({ error: "format must be pdf, xlsx or csv" });
    const range = rangeFromQuery(req, kind);
    if (!range) return res.status(400).json({ error: "Invalid period." });

    try {
      const [doc, config] = await Promise.all([buildReport(kind, range), storage.getPlatformConfig()]);
      const brandColor = config.dashboardColor ?? null;
      const stamp = !doc.period
        ? doc.generatedAt.slice(0, 10)
        : doc.period.start === "1900-01-01"
          ? "all-time"
          : doc.period.start.slice(0, 7) === doc.period.end.slice(0, 7)
            ? doc.period.start.slice(0, 7)
            : `${doc.period.start}_to_${doc.period.end}`;
      const base = safeFilename(`${doc.organization.name}-${doc.title}-${stamp}`);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${base}.csv"`);
        return res.send(renderReportCsv(doc));
      }
      if (format === "xlsx") {
        const buf = await renderReportXlsx(doc, { brandColor });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
        return res.send(buf);
      }
      const buf = await renderReportPdf(doc, { brandColor });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `${req.query.inline ? "inline" : "attachment"}; filename="${base}.pdf"`);
      return res.send(buf);
    } catch (err) {
      console.error(`[reports] export ${kind}/${format} failed:`, err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Could not export the report" });
    }
  });
}
