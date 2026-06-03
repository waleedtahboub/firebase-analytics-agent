// Reads the user-filled tracking spreadsheet back into structured events.
import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { APPROVAL_COL_INDEX } from "../lib/excelSchema.js";
import { statePaths } from "../session.js";
import type { TrackingEvent } from "../types.js";

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const v = value as any;
    if ("result" in v) return String(v.result ?? "");
    if ("text" in v) return String(v.text ?? "");
    if ("richText" in v) return (v.richText ?? []).map((r: any) => r.text).join("");
  }
  return String(value);
}

export async function readTrackingExcel(path: string): Promise<TrackingEvent[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet("Tracking") ?? wb.worksheets[0];
  const events: TrackingEvent[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const get = (i: number) => cellText(row.getCell(i).value).trim();
    const eventName = get(1);
    if (!eventName) return; // skip blank rows
    const raw = get(APPROVAL_COL_INDEX);
    let finalApproval: number | null = raw === "" ? null : Number(raw);
    if (finalApproval !== null && Number.isNaN(finalApproval)) finalApproval = null;
    events.push({
      eventName,
      description: get(2),
      parameters: get(3),
      screen: get(4),
      notes: get(5),
      finalApproval,
    });
  });
  return events;
}

export function makeExcelReadTool(ctx: { projectPath: string }) {
  return tool(
    "excel_read_tracking",
    "Read back the user-filled tracking.xlsx. Returns events grouped by their Final Approval decision. Only events with Final Approval = 1 should be implemented; ignore 0 and treat blanks as not-yet-decided.",
    {},
    async () => {
      const path = statePaths(ctx.projectPath).trackingXlsx;
      if (!existsSync(path)) {
        return {
          content: [{ type: "text" as const, text: `No tracking.xlsx at ${path}. Run analyze first.` }],
        };
      }
      const all = await readTrackingExcel(path);
      const approved = all.filter((e) => e.finalApproval === 1);
      const skipped = all.filter((e) => e.finalApproval === 0);
      const undecided = all.filter((e) => e.finalApproval == null);
      const summary = {
        approvedCount: approved.length,
        skippedCount: skipped.length,
        undecidedCount: undecided.length,
        approved,
        undecidedNames: undecided.map((e) => e.eventName),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );
}
