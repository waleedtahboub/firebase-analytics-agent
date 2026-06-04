import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'fs';

// Mapping: checklist Final Approvel decisions -> agent event names
// finalApproval: 1 = approved, 0 = rejected
const mapping = [
  { agentEvents: [], finalApproval: 1, isNew: true, newName: 'first_open', newDesc: 'First time the app is opened by a new install. Top of every funnel; with install attribution shows which marketing channel delivered the user.', newParams: '', newScreen: 'main.dart / app startup', newNotes: 'Reserved GA4 event, auto-collected when firebase_analytics initializes. Confirm auto-collection is not disabled.' },
  { agentEvents: ['sign_up', 'sign_up_failed'], finalApproval: 1 },
  { agentEvents: ['login', 'login_failed'], finalApproval: 1 },
  { agentEvents: ['otp_submitted', 'otp_failed', 'otp_resend_requested'], finalApproval: 1 },
  { agentEvents: ['profile_photo_added'], finalApproval: 0 },
  { agentEvents: ['logout'], finalApproval: 0 },
  { agentEvents: ['view_item_list', 'listing_list_loaded_more', 'listing_list_refreshed'], finalApproval: 1 },
  { agentEvents: ['region_filter_selected'], finalApproval: 1 },
  { agentEvents: ['search', 'search_history_selected', 'search_history_cleared'], finalApproval: 1 },
  { agentEvents: ['search_no_results'], finalApproval: 1 },
  { agentEvents: ['filter_opened'], finalApproval: 1 },
  { agentEvents: ['filter_applied'], finalApproval: 1 },
  { agentEvents: ['filter_chip_removed'], finalApproval: 0 },
  { agentEvents: ['filter_cleared'], finalApproval: 1 },
  { agentEvents: ['view_item', 'select_item'], finalApproval: 1 },
  { agentEvents: ['listing_image_viewed'], finalApproval: 1 },
  { agentEvents: ['listing_reviews_opened'], finalApproval: 1 },
  { agentEvents: ['listing_map_viewed'], finalApproval: 0 },
  { agentEvents: ['add_to_wishlist', 'remove_from_wishlist'], finalApproval: 1 },
  { agentEvents: ['listing_liked'], finalApproval: 0 },
  { agentEvents: ['share'], finalApproval: 1 },
  { agentEvents: ['contact_host_tapped'], finalApproval: 0 },
  { agentEvents: ['listing_unavailable_viewed'], finalApproval: 0 },
  { agentEvents: ['begin_checkout', 'booking_dates_updated'], finalApproval: 1 },
  { agentEvents: ['booking_addon_updated'], finalApproval: 1 },
  { agentEvents: ['booking_summary_viewed', 'reservation_created'], finalApproval: 1 },
  { agentEvents: ['add_payment_info', 'payment_submitted'], finalApproval: 1 },
  { agentEvents: ['purchase', 'payment_pending'], finalApproval: 1 },
  { agentEvents: ['payment_failed'], finalApproval: 1 },
  { agentEvents: ['incomplete_reservation_blocked'], finalApproval: 0 },
  { agentEvents: ['view_reservations_list', 'view_reservation_details'], finalApproval: 1 },
  { agentEvents: ['reservation_cancelled'], finalApproval: 1 },
  { agentEvents: ['refund'], finalApproval: 0 },
  { agentEvents: ['owner_reservation_responded'], finalApproval: 1 },
  { agentEvents: ['wallet_viewed', 'wallet_transactions_viewed'], finalApproval: 0 },
  { agentEvents: ['add_listing_started'], finalApproval: 1 },
  { agentEvents: ['add_listing_step_completed', 'add_listing_images_uploaded', 'add_listing_preview_viewed'], finalApproval: 1 },
  { agentEvents: ['listing_submitted', 'listing_submit_failed', 'listing_draft_saved', 'listing_under_review_viewed'], finalApproval: 1 },
  { agentEvents: ['hire_professional_requested'], finalApproval: 0 },
  { agentEvents: ['payout_method_added', 'payout_method_updated', 'payout_method_deleted', 'payout_frequency_updated'], finalApproval: 1 },
  { agentEvents: ['review_submitted'], finalApproval: 1 },
  { agentEvents: ['review_updated', 'review_deleted', 'review_reported'], finalApproval: 0 },
  { agentEvents: ['notification_opened_list', 'notification_tapped', 'push_notification_received', 'push_notification_opened'], finalApproval: 1 },
  { agentEvents: ['view_other_profile'], finalApproval: 0 },
  { agentEvents: ['user_blocked', 'user_unblocked', 'user_reported'], finalApproval: 1 },
  { agentEvents: ['language_changed'], finalApproval: 0 },
  { agentEvents: ['edit_profile_saved'], finalApproval: 0 },
  { agentEvents: ['delete_account_started', 'delete_account_completed'], finalApproval: 1 },
  { agentEvents: ['contact_us_submitted'], finalApproval: 1 },
  { agentEvents: ['in_app_web_opened', 'no_internet_viewed', 'maintenance_viewed', 'app_update_prompted'], finalApproval: 0 },
  { agentEvents: ['kyc_start', 'kyc_step_completed', 'kyc_id_uploaded', 'kyc_submitted', 'kyc_submit_failed', 'kyc_status_viewed'], finalApproval: 0 },
];

// New events approved in checklist but missing from agent output
const newEvents = [
  {
    eventName: 'first_open',
    description: 'First time the app is opened after a new install. Top of every funnel; with install attribution shows which marketing channel/campaign delivered the user.',
    parameters: '',
    screen: 'main.dart / app startup',
    notes: 'Reserved GA4 auto-collected event. Confirm auto-collection is enabled in firebase_analytics initialization.',
    finalApproval: 1
  },
  {
    eventName: 'listing_status_change',
    description: 'Host edited, deactivated, or deleted a listing. Supply-churn signal — hosts pulling inventory is a leading indicator of shrinking supply.',
    parameters: 'listing_id:string, action:string',
    screen: 'Host listing management screens',
    notes: 'action = edited|deactivated|deleted.',
    finalApproval: 1
  },
  {
    eventName: 'self_reservation_create',
    description: 'Host created a reservation on behalf of an off-platform guest (walk-in or phone booking). Shows off-app business that could be brought on-platform. Excluded from GMV (no in-app payment).',
    parameters: 'listing_id:string',
    screen: 'Host self/owner reservation screen',
    notes: 'Distinguish from guest purchase by checking user role.',
    finalApproval: 1
  },
  {
    eventName: 'push_notification_opt_in',
    description: 'User granted or denied push notification permission. Defines the reachable audience size for all re-engagement campaigns. Low opt-in caps all push ROI.',
    parameters: 'granted:int',
    screen: 'OS permission dialog (triggered from app onboarding or settings)',
    notes: 'granted = 1 allowed / 0 denied. One-time event per install.',
    finalApproval: 1
  },
];

// Build approval map
const approvalMap = {};
for (const m of mapping) {
  for (const ae of m.agentEvents) {
    if (approvalMap[ae] === undefined) {
      approvalMap[ae] = m.finalApproval;
    } else if (m.finalApproval === 1) {
      approvalMap[ae] = 1; // 1 wins
    }
  }
}

// Read and update tracking.xlsx
const trackingPath = 'C:/Users/walee_/Desktop/root/01_24Online/01_projects/03_tasheh/tasheh/.analytics-agent/tracking.xlsx';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(trackingPath);
const ws = wb.getWorksheet('Tracking') ?? wb.worksheets[0];

let updated = 0;
ws.eachRow((row, i) => {
  if (i === 1) return;
  const name = String(row.getCell(1).value ?? '').trim();
  if (!name) return;
  const approval = approvalMap[name];
  if (approval !== undefined) {
    row.getCell(6).value = approval;
    updated++;
  }
});

// Append new events
const lastRow = ws.rowCount;
for (const ev of newEvents) {
  const r = ws.addRow([ev.eventName, ev.description, ev.parameters, ev.screen, ev.notes, ev.finalApproval]);
  // Style: match existing data rows
  r.font = { size: 10 };
  r.alignment = { wrapText: true, vertical: 'top' };
  r.getCell(6).value = ev.finalApproval;
}

await wb.xlsx.writeFile(trackingPath);

// Also update tracking.json
const jsonPath = 'C:/Users/walee_/Desktop/root/01_24Online/01_projects/03_tasheh/tasheh/.analytics-agent/tracking.json';
const events = JSON.parse(readFileSync(jsonPath, 'utf8'));
for (const ev of events) {
  const approval = approvalMap[ev.eventName];
  if (approval !== undefined) ev.finalApproval = approval;
}
for (const ev of newEvents) events.push(ev);
writeFileSync(jsonPath, JSON.stringify(events, null, 2), 'utf8');

// Print summary
const approvedNames = events.filter(e => e.finalApproval === 1).map(e => e.eventName);
const rejectedNames = events.filter(e => e.finalApproval === 0).map(e => e.eventName);
const undecided = events.filter(e => e.finalApproval == null).map(e => e.eventName);

console.log('✅ APPROVED (' + approvedNames.length + '):');
approvedNames.forEach(n => console.log('   ' + n));
console.log('\n❌ REJECTED (' + rejectedNames.length + '):');
rejectedNames.forEach(n => console.log('   ' + n));
if (undecided.length) { console.log('\n❓ UNDECIDED (' + undecided.length + '):'); undecided.forEach(n => console.log('   ' + n)); }
console.log('\nDone. Updated ' + updated + ' existing rows, added ' + newEvents.length + ' new events.');
