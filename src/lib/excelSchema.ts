// Column definitions + styling constants for the tracking spreadsheet.
// Shared by the writer and reader so they never drift apart.

export interface ColumnDef {
  key: string;
  header: string;
  width: number;
  wrap?: boolean;
}

export const COLUMNS: ColumnDef[] = [
  { key: "rowNum",        header: "#",                              width: 5  },
  { key: "section",       header: "Section",                        width: 26, wrap: true },
  { key: "priority",      header: "Priority",                       width: 9  },
  { key: "whatWeTrack",   header: "What we track",                  width: 30, wrap: true },
  { key: "whyItMatters",  header: "Why it matters / what it answers", width: 52, wrap: true },
  { key: "eventName",     header: "Event (for dev)",                width: 36, wrap: true },
  { key: "approve",       header: "Approve?",                       width: 10 },
  { key: "notes",         header: "Notes",                          width: 36, wrap: true },
  { key: "finalApproval", header: "Final Approvel?",                width: 14 },
];

/** 1-based index of the Final Approvel? column (the user-decision column). */
export const APPROVAL_COL_INDEX = COLUMNS.findIndex((c) => c.key === "finalApproval") + 1;

/** 1-based index of the Event (for dev) column — used by the reader as the event name key. */
export const EVENT_NAME_COL_INDEX = COLUMNS.findIndex((c) => c.key === "eventName") + 1;

/** ARGB colors (exceljs wants the leading FF alpha). */
export const COLORS = {
  navy: "FF1F3864",
  white: "FFFFFFFF",
  green: "FFC6EFCE",
  red: "FFFFC7CE",
  band: "FFF2F2F2",
};

/** Allowed values for the Final Approval dropdown. */
export const APPROVAL_LIST = '"1,0"';
