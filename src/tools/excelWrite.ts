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
  events.forEach((e) => {
    const row = ws.addRow({
      eventName: e.eventName,
      description: e.description,
      parameters: e.parameters,
      screen: e.screen,
      notes: e.notes ?? "",
      finalApproval: e.finalApproval ?? "",
    });
    row.alignment = { vertical: "top", wrapText: true };
    const lines = Math.max(
      1,
      Math.ceil((e.description || "").length / 58),
      Math.ceil((e.parameters || "").length / 38)
    );
    row.height = Math.max(28, lines * 14 + 6);
    row.eachCell({ includeEmpty: true }, (cell) => (cell.border = border));
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
            eventName: z.string().describe("Firebase event name, snake_case"),
            description: z.string().describe("What it tracks and why it matters"),
            parameters: z.string().describe('Params as "key:type, key:type", or "" if none'),
            screen: z.string().describe("Where it fires (screen/route/widget)"),
            notes: z.string().describe("Clarifications for the team, or empty string"),
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
