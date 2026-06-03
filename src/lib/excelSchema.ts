// Column definitions + styling constants for the tracking spreadsheet.
// Shared by the writer and reader so they never drift apart.

export interface ColumnDef {
  key: string;
  header: string;
  width: number;
  wrap?: boolean;
}

export const COLUMNS: ColumnDef[] = [
  { key: "eventName", header: "Event Name", width: 30 },
  { key: "description", header: "Description", width: 60, wrap: true },
  { key: "parameters", header: "Parameters", width: 40, wrap: true },
  { key: "screen", header: "Screen", width: 24, wrap: true },
  { key: "notes", header: "Notes", width: 34, wrap: true },
  { key: "finalApproval", header: "Final Approval", width: 14 },
];

/** 1-based index of the Final Approval column (the user-decision column). */
export const APPROVAL_COL_INDEX = COLUMNS.findIndex((c) => c.key === "finalApproval") + 1;

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
