// No-API self-test: verifies the Excel writer + reader round-trip.
// Run:  npx tsx scripts/selftest.ts
import { writeTrackingExcel } from "../src/tools/excelWrite.js";
import { readTrackingExcel } from "../src/tools/excelRead.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, statSync } from "node:fs";

const out = join(tmpdir(), "fa_selftest.xlsx");

const events = [
  { eventName: "login", description: "User logs in; reveals which auth method converts.", parameters: "method:string", screen: "SignInPage", notes: "" },
  { eventName: "search", description: "User searches farms; the core demand signal.", parameters: "search_term:string, result_count:int", screen: "SearchPage", notes: "abandon tracked separately" },
  { eventName: "purchase", description: "Booking completed; GMV + average order value.", parameters: "value:int, currency:string", screen: "PaymentConfirmPage", notes: "" },
];

await writeTrackingExcel(events as any, out);
console.log(`wrote: ${existsSync(out)} (${statSync(out).size} bytes) -> ${out}`);

const read = await readTrackingExcel(out);
console.log(`read back: ${read.length} rows`);
for (const e of read) console.log(`  - ${e.eventName} | screen=${e.screen} | approval=${String(e.finalApproval)}`);

const ok =
  read.length === events.length &&
  read[0].eventName === "login" &&
  read[0].finalApproval == null &&
  read[1].parameters.includes("result_count");

console.log(ok ? "\nROUND-TRIP OK ✅" : "\nROUND-TRIP FAILED ✖");
process.exit(ok ? 0 : 1);
