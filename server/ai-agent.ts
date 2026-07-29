import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response } from "express";
import { z } from "zod";
import { query } from "./db";

const SYSTEM_PROMPT = `You are Distillr AI, an expert operations assistant embedded inside the Distillr distillery management platform for a licensed Distilled Spirits Plant (DSP).

Your expertise covers:
- TTB federal compliance: Form 5110.40 (Operations Report), 5110.11 (Storage Report), 5110.28 (Processing Report), 5000.24 (Excise Tax Return), COLA label approvals, bond requirements, record retention (minimum 3 years per 27 CFR § 19.618).
- Federal excise tax: standard rate $13.50/proof gallon, CBMA craft producer reduced rate $2.70/PG for first 100,000 PG/year, $13.34/PG for 100,001–22,130,000 PG, reduced rates reset each calendar year.
- Spirit production: mash bill, fermentation, pot vs. column distillation, proofing, barrel entry proof (max 125 proof per TTB), char levels, angel's share evaporation, proof gallons vs. wine gallons (PG = wine gallons × proof / 100).
- Inventory accounting: bonded premises, tax-determined spirits, beginning/ending bond balance, Part I/II/III/IV of 5110.40.
- Sales and distribution: state franchise laws, distributor vs. DTC channels, shipping compliance.

You have read-only access to live distillery data via tools. Always query the data before answering operational questions. Be precise: always specify units (PG = proof gallons, WG = wine gallons). Keep answers concise and actionable.

Boundary: You cannot modify any records. For binding legal or compliance determinations, recommend consulting a licensed attorney or TTB consultant.`;

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_distillery_summary",
    description: "Get high-level KPIs: active batch count by stage, total barrels on hand, upcoming permit expirations, latest bond balance, open sales orders.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_batch_records",
    description: "List production batch records, optionally filtered by stage or date range.",
    input_schema: {
      type: "object" as const,
      properties: {
        stage: { type: "string", description: "Filter by stage: planning | mash_fermentation | distillation | barreling | aging | bottling | closed" },
        from_date: { type: "string", description: "Start date YYYY-MM-DD" },
        to_date: { type: "string", description: "End date YYYY-MM-DD" },
        limit: { type: "number", description: "Max records (default 15, max 50)" },
      },
      required: [],
    },
  },
  {
    name: "get_production_records",
    description: "List mash/distillation production records with gallons distilled and proof gallons.",
    input_schema: {
      type: "object" as const,
      properties: {
        batch_record_id: { type: "string" },
        from_date: { type: "string" },
        to_date: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "get_inventory_records",
    description: "List monthly inventory records showing cases made, cases sold, and ending bond balance.",
    input_schema: {
      type: "object" as const,
      properties: {
        product_name: { type: "string" },
        from_period: { type: "string", description: "YYYY-MM" },
        to_period: { type: "string", description: "YYYY-MM" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "get_barrels",
    description: "List barrels with aging details, proof gallons, location, and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "e.g. aging, dumped, full" },
        min_aging_days: { type: "number" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "get_permits",
    description: "List all DSP permits and licenses with expiration dates and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "active | expired | pending" },
      },
      required: [],
    },
  },
  {
    name: "get_sales_orders",
    description: "List sales orders with client, status, amount, and line items.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string" },
        from_date: { type: "string" },
        to_date: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "get_compliance_records",
    description: "List compliance items (regulatory requirements, audits, inspections) with status and severity.",
    input_schema: {
      type: "object" as const,
      properties: {
        regulatory_area: { type: "string" },
        status: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "get_ttb_reports",
    description: "List filed or pending TTB operational and excise tax reports.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string" },
        from_date: { type: "string" },
        to_date: { type: "string" },
      },
      required: [],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const lim = Math.min(Number(input.limit ?? 15), 50);

  try {
    switch (name) {
      case "get_distillery_summary": {
        const [stages, barrelCount, permits, inventory, orders] = await Promise.all([
          query(`SELECT stage, COUNT(*)::int as count FROM distilling_batch_records GROUP BY stage ORDER BY count DESC`),
          query(`SELECT COUNT(*)::int as total, status FROM barrels GROUP BY status`),
          query(`SELECT id, permit_type, expiration_date, status,
                   (expiration_date::date - CURRENT_DATE) AS days_until_expiry
                 FROM permits WHERE status != 'revoked' ORDER BY expiration_date ASC LIMIT 5`),
          query(`SELECT report_month, ending_proof_gallons, ending_month_inventory, ending_us_gallons
                 FROM distilling_inventory_records ORDER BY report_month DESC LIMIT 1`),
          query(`SELECT status, COUNT(*)::int as count, SUM(total_amount) as total
                 FROM sales_orders GROUP BY status`),
        ]);
        return JSON.stringify({ batchesByStage: stages, barrels: barrelCount, permitsExpiringSoon: permits, latestInventory: inventory[0] ?? null, salesOrders: orders });
      }

      case "get_batch_records": {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.stage) { conditions.push(`stage = $${params.length + 1}`); params.push(input.stage); }
        if (input.from_date) { conditions.push(`batch_date >= $${params.length + 1}`); params.push(input.from_date); }
        if (input.to_date) { conditions.push(`batch_date <= $${params.length + 1}`); params.push(input.to_date); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        params.push(lim);
        const rows = await query(`SELECT id, batch_code, batch_date, stage, status, notes FROM distilling_batch_records ${where} ORDER BY batch_date DESC LIMIT $${params.length}`, params);
        return JSON.stringify(rows);
      }

      case "get_production_records": {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.batch_record_id) { conditions.push(`batch_record_id = $${params.length + 1}`); params.push(input.batch_record_id); }
        if (input.from_date) { conditions.push(`distill_date >= $${params.length + 1}`); params.push(input.from_date); }
        if (input.to_date) { conditions.push(`distill_date <= $${params.length + 1}`); params.push(input.to_date); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        params.push(lim);
        const rows = await query(`SELECT id, batch_record_id, mash_date, distill_date, gallons_distilled, percentage_distilled, proof_of_gallons, gallons_molasses, lbs_sugar FROM distilling_production_records ${where} ORDER BY distill_date DESC LIMIT $${params.length}`, params);
        return JSON.stringify(rows);
      }

      case "get_inventory_records": {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.product_name) { conditions.push(`product_name ILIKE $${params.length + 1}`); params.push(`%${input.product_name}%`); }
        if (input.from_period) { conditions.push(`report_month >= $${params.length + 1}`); params.push(input.from_period); }
        if (input.to_period) { conditions.push(`report_month <= $${params.length + 1}`); params.push(input.to_period); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        params.push(lim);
        const rows = await query(`SELECT id, title, product_name, report_month, beginning_of_month_cases, ending_month_inventory, ending_us_gallons, ending_proof_gallons, notes FROM distilling_inventory_records ${where} ORDER BY report_month DESC LIMIT $${params.length}`, params);
        return JSON.stringify(rows);
      }

      case "get_barrels": {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.status) { conditions.push(`status = $${params.length + 1}`); params.push(input.status); }
        if (input.min_aging_days) { conditions.push(`total_aging_days >= $${params.length + 1}`); params.push(input.min_aging_days); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        params.push(lim);
        const rows = await query(`SELECT id, serial_number, product_name, fill_date, fill_proof, fill_proof_gallons, current_proof_gallons, total_aging_days, status, warehouse_zone, char_level, losses_proof_gallons FROM barrels ${where} ORDER BY fill_date DESC LIMIT $${params.length}`, params);
        return JSON.stringify(rows);
      }

      case "get_permits": {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.status) { conditions.push(`status = $${params.length + 1}`); params.push(input.status); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        const rows = await query(`SELECT id, permit_type, permit_number, issuing_authority, state, issue_date, expiration_date, status, notes FROM permits ${where} ORDER BY expiration_date ASC`);
        return JSON.stringify(rows);
      }

      case "get_sales_orders": {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.status) { conditions.push(`status = $${params.length + 1}`); params.push(input.status); }
        if (input.from_date) { conditions.push(`order_date >= $${params.length + 1}`); params.push(input.from_date); }
        if (input.to_date) { conditions.push(`order_date <= $${params.length + 1}`); params.push(input.to_date); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        params.push(lim);
        const rows = await query(`SELECT so.id, so.order_number, so.status, so.order_date, so.total_amount, so.currency, c.name as client_name FROM sales_orders so LEFT JOIN clients c ON so.client_id = c.id ${where} ORDER BY so.order_date DESC LIMIT $${params.length}`, params);
        return JSON.stringify(rows);
      }

      case "get_compliance_records": {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.regulatory_area) { conditions.push(`regulatory_area ILIKE $${params.length + 1}`); params.push(`%${input.regulatory_area}%`); }
        if (input.status) { conditions.push(`status = $${params.length + 1}`); params.push(input.status); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        const rows = await query(`SELECT id, type, regulatory_area, jurisdiction, status, expires, severity, owner FROM compliance ${where} ORDER BY expires ASC NULLS LAST LIMIT 30`);
        return JSON.stringify(rows);
      }

      case "get_ttb_reports": {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.status) { conditions.push(`status = $${params.length + 1}`); params.push(input.status); }
        if (input.from_date) { conditions.push(`report_period_start >= $${params.length + 1}`); params.push(input.from_date); }
        if (input.to_date) { conditions.push(`report_period_end <= $${params.length + 1}`); params.push(input.to_date); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        const rows = await query(`SELECT id, report_period_start, report_period_end, filing_type, filing_cadence, due_date, excise_tax_due, status FROM ttb_reports ${where} ORDER BY report_period_start DESC LIMIT 20`);
        return JSON.stringify(rows);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" });
  }
}

// ── Request schema ────────────────────────────────────────────────────────────

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(8000),
    })
  ).min(1).max(100),
});

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleAiChat(req: Request, res: Response): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "AI agent not configured — add ANTHROPIC_API_KEY to environment variables." });
    return;
  }

  let body: z.infer<typeof chatSchema>;
  try {
    body = chatSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Keep last 20 messages to avoid token overflow
  const trimmed = body.messages.slice(-20);
  let messages: Anthropic.MessageParam[] = trimmed.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop — max 5 tool-call iterations
  for (let i = 0; i < 5; i++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "AI request failed." });
      return;
    }

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("\n");
      res.json({ message: text });
      return;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tb) => {
          const result = await executeTool(tb.name, tb.input as Record<string, unknown>);
          return {
            type: "tool_result" as const,
            tool_use_id: tb.id,
            content: result,
          };
        })
      );

      // Append assistant message + tool results to continue the loop
      messages = [
        ...messages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];
      continue;
    }

    // Unexpected stop reason
    break;
  }

  res.status(500).json({ error: "Agent did not produce a final response. Please try again." });
}
