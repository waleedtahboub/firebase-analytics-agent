// Generates the tracking spreadsheet (the artifact the user fills with 1/0).
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { COLUMNS, COLORS, APPROVAL_COL_INDEX, APPROVAL_LIST } from "../lib/excelSchema.js";
import { statePaths, ensureStateDir } from "../session.js";
import type { TrackingEvent } from "../types.js";

const thin = { style: "thin", color: { argb: "FFD9D9D9" } } as const;
const border: any = { top: thin, left: thin, right: thin, bottom: thin };

/** Build and write the tracking workbook to outPath. */
export async function writeTrackingExcel(
  events: TrackingEvent[],
  outPath: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tracking", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // Header styling.
  const header = ws.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: COLORS.white } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } } as any;
    cell.border = border;
  });

  // Data rows.
  events.forEach((e, i) => {
    const row = ws.addRow({
      rowNum:       i + 1,
      section:      e.section ?? "",
      priority:     e.priority ?? "",
      whatWeTrack:  e.whatWeTrack ?? "",
      whyItMatters: e.whyItMatters ?? "",
      eventName:    e.eventName ?? "",
      approve:      "",
      notes:        e.notes ?? "",
      finalApproval: e.finalApproval ?? "",
    });
    row.alignment = { vertical: "top", wrapText: true };
    const lines = Math.max(
      1,
      Math.ceil((e.whyItMatters || "").length / 50),
      Math.ceil((e.whatWeTrack || "").length / 28)
    );
    row.height = Math.max(28, lines * 14 + 6);
    row.eachCell({ includeEmpty: true }, (cell) => (cell.border = border));
    // Center the short columns
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(APPROVAL_COL_INDEX).alignment = { vertical: "middle", horizontal: "center" };
  });

  const lastRow = ws.rowCount;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  // Final Approval dropdown (1/0) on every data row.
  const colLetter = ws.getColumn(APPROVAL_COL_INDEX).letter;
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`${colLetter}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [APPROVAL_LIST],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Pick 1 or 0",
      error: "1 = implement this event, 0 = skip it",
    } as any;
  }

  // Color the decision: green for 1, red for 0.
  if (lastRow >= 2) {
    const ref = `${colLetter}2:${colLetter}${lastRow}`;
    ws.addConditionalFormatting({
      ref,
      rules: [
        {
          type: "cellIs",
          operator: "equal",
          priority: 1,
          formulae: ["1"],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLORS.green } } },
        },
        {
          type: "cellIs",
          operator: "equal",
          priority: 2,
          formulae: ["0"],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COLORS.red } } },
        },
      ],
    } as any);
  }

  // Scorecard sheet with live counts.
  const sc = wb.addWorksheet("Scorecard");
  sc.getColumn(1).width = 26;
  sc.getColumn(2).width = 14;
  sc.addRow(["Metric", "Count"]);
  sc.getRow(1).font = { bold: true, color: { argb: COLORS.white } };
  sc.getRow(1).eachCell(
    (c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } } as any)
  );
  const tref = `Tracking!${colLetter}2:${colLetter}${Math.max(lastRow, 2)}`;
  sc.addRow(["Approved (1)", { formula: `COUNTIF(${tref},1)` }]);
  sc.addRow(["Skipped (0)", { formula: `COUNTIF(${tref},0)` }]);
  sc.addRow(["Not yet decided", { formula: `${events.length}-COUNTIF(${tref},1)-COUNTIF(${tref},0)` }]);
  sc.addRow(["Total events", events.length]);

  await wb.xlsx.writeFile(outPath);
}

/** The SDK tool the agent calls to emit the spreadsheet. */
export function makeExcelWriteTool(ctx: { projectPath: string }) {
  return tool(
    "excel_write_tracking",
    "Write the proposed analytics events to tracking.xlsx (with a blank Final Approval column for the user to fill 1/0) and a machine-readable tracking.json. Call this once, last, after you have gathered all events.",
    {
      events: z
        .array(
          z.object({
            section:      z.string().describe('Business section, e.g. "A · Acquisition & Onboarding"'),
            priority:     z.string().describe("Priority tier: P0 (must-have), P1 (important), P2 (nice-to-have)"),
            whatWeTrack:  z.string().describe('Short human label, e.g. "Sign-up completed"'),
            whyItMatters: z.string().describe("Business rationale — what question this event answers"),
            eventName:    z.string().describe("Firebase event name (snake_case) + params + firing screen, e.g. \"sign_up | method:string | RegisterAccountPage\""),
            notes:        z.string().describe("Implementation hints, PII warnings, or empty string"),
          })
        )
        .describe("All proposed analytics events"),
    },
    async (args: { events: TrackingEvent[] }) => {
      ensureStateDir(ctx.projectPath);
      const paths = statePaths(ctx.projectPath);
      await writeTrackingExcel(args.events, paths.trackingXlsx);
      writeFileSync(paths.trackingJson, JSON.stringify(args.events, null, 2), "utf8");
      return {
        content: [
          {
            type: "text" as const,
            text: `Wrote ${args.events.length} events to ${paths.trackingXlsx} and ${paths.trackingJson}.`,
          },
        ],
      };
    }
  );
}
