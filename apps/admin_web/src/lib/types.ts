export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  firebase_uid: string;
  timezone: string;
  is_platform_admin: boolean;
};

export type ShopMembership = {
  id: string;
  role: "owner" | "admin" | "staff" | "viewer";
  status: "active" | "invited" | "disabled";
  permissions_version: number;
  permissions_json: Record<string, unknown>;
  shop: {
    id: string;
    name: string;
    slug: string;
    currency_code: string;
    timezone: string;
    is_active: boolean;
  };
};

export type SessionPayload = {
  user: SessionUser;
  memberships: ShopMembership[];
  active_shop_id: string | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  subcategory: string;
  size: string;
  description: string;
  sell_price: string;
  status: string;
  tombstone: boolean;
  source_meta_json: Record<string, unknown>;
  stock_on_hand: number;
  cost_price: string | null;
  supplier_id: string | null;
  last_purchase_date: string | null;
};

export type InventoryStats = {
  totalItems: number;
  activeItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  categories: number;
  projectedSellValue: number;
};

export type ShopDomainState = {
  shop_id: string;
  domain: string;
  control_present: boolean;
  write_master: "firebase" | "postgres";
  bridge_mode: "disabled" | "compare_only" | "firebase_to_postgres" | "postgres_to_firebase";
  cutover_status: "legacy" | "pilot" | "ready" | "postgres_primary";
  current_epoch: number;
  shadow_reads_enabled: boolean;
  is_enabled: boolean;
  can_write_on_postgres_surface: boolean;
  pilot_signoff_status:
    | "blocked"
    | "ready_for_cutover"
    | "monitoring"
    | "production_safe"
    | "rollback_recommended"
    | null;
  pilot_signoff_summary: string | null;
  pilot_recommended_action: string | null;
  pilot_latest_verify_result: string | null;
};

export type DashboardLowStockItem = {
  id: string;
  inventory_item_id: string | null;
  item_name: string;
  sku: string;
  category: string;
  stock_on_hand: number;
  sell_price: string;
  severity_rank: number;
  refreshed_at: string;
};

export type DashboardSnapshot = {
  id: string;
  shop: string;
  inventory_items_count: number;
  active_inventory_items_count: number;
  category_count: number;
  low_stock_items_count: number;
  out_of_stock_items_count: number;
  projected_sell_value: string;
  customer_count: number;
  active_credit_customers_count: number;
  total_outstanding_balance: string;
  total_lifetime_spend: string;
  sales_count: number;
  gross_revenue: string;
  outstanding_revenue: string;
  payment_count: number;
  total_collected: string;
  credit_payment_count: number;
  digital_payment_count: number;
  last_sale_at: string | null;
  refreshed_at: string;
  metadata_json: Record<string, unknown>;
  low_stock_preview: DashboardLowStockItem[];
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  total_spent: string;
  balance: string;
  notes: string;
  status: string;
  tombstone: boolean;
  source_meta_json: Record<string, unknown>;
};

export type CustomerStats = {
  totalCustomers: number;
  activeCredits: number;
  totalOutstanding: number;
  totalLifetimeSpend: number;
};

export type Expense = {
  id: string;
  category: string;
  amount: string;
  description: string;
  payment_method: "CASH" | "UPI" | "BANK" | "CARD" | "OTHER";
  payment_reference: string;
  expense_date: string;
  tombstone: boolean;
  actor_name: string | null;
};

export type ExpenseStats = {
  totalEntries: number;
  totalAmount: number;
  uniqueCategories: number;
  biggestCategory: string | null;
};

export type AttendanceSession = {
  id: string;
  membership_id: string;
  member_name: string;
  member_role: string;
  session_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
  total_hours: string | null;
  overtime_hours: string;
  bonus_amount: string;
  note: string;
  tombstone: boolean;
};

export type AttendanceStats = {
  totalSessions: number;
  presentCount: number;
  leaveCount: number;
  activeWorkersToday: number;
};

export type SaleItem = {
  id: string;
  inventory_item_id: string | null;
  name: string;
  sku: string;
  size: string;
  quantity: number;
  unit_price: string;
  unit_cost: string | null;
  line_total: string;
  is_return: boolean;
};

export type SalePayment = {
  id: string;
  payment_method: "CASH" | "UPI" | "BANK" | "CARD" | "CREDIT" | "OTHER";
  amount: string;
  reference_code: string;
  note: string;
  occurred_at: string;
};

export type Sale = {
  id: string;
  receipt_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  amount_received: string;
  amount_due: string;
  payment_mode: string;
  footer_note: string;
  note: string;
  sale_date: string;
  occurred_at: string;
  status: string;
  tombstone: boolean;
  source_meta_json: Record<string, unknown>;
  actor_name: string | null;
  item_count: number;
  payment_count: number;
  items: SaleItem[];
  payments: SalePayment[];
};

export type SalePaymentRecord = {
  id: string;
  sale_id: string;
  receipt_number: string;
  customer_name: string;
  sale_total_amount: string;
  payment_method: "CASH" | "UPI" | "BANK" | "CARD" | "CREDIT" | "OTHER";
  amount: string;
  reference_code: string;
  note: string;
  occurred_at: string;
  actor_name: string | null;
};

export type SalesStats = {
  totalSales: number;
  grossRevenue: number;
  outstandingRevenue: number;
  averageTicket: number;
};

export type PaymentStats = {
  paymentCount: number;
  totalCollected: number;
  creditCount: number;
  digitalShareCount: number;
};

export type MigrationDomainControl = {
  id: string;
  shop: string;
  shop_name: string;
  shop_slug: string;
  domain: string;
  write_master: "firebase" | "postgres";
  bridge_mode: "disabled" | "compare_only" | "firebase_to_postgres" | "postgres_to_firebase";
  cutover_status: "legacy" | "pilot" | "ready" | "postgres_primary";
  current_epoch: number;
  shadow_reads_enabled: boolean;
  is_enabled: boolean;
  last_backfill_at: string | null;
  last_shadow_verified_at: string | null;
  metadata_json: Record<string, unknown>;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type MigrationJobRun = {
  id: string;
  shop: string | null;
  shop_name: string | null;
  domain: string;
  job_type: "backfill" | "shadow_compare" | "bridge_replay" | "projection_refresh";
  status: "queued" | "running" | "succeeded" | "failed";
  actor_user: string | null;
  actor_name: string | null;
  trace_id: string;
  rows_scanned: number;
  rows_written: number;
  rows_skipped: number;
  mismatch_count: number;
  error_message: string;
  payload_json: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MigrationBridgeReceipt = {
  id: string;
  shop: string;
  shop_name: string;
  domain: string;
  origin_system: string;
  origin_event_id: string;
  command_type: string;
  entity_type: string;
  entity_id: string;
  base_domain_epoch: number;
  payload_json: Record<string, unknown>;
  applied_at: string;
  created_at: string;
  updated_at: string;
};

export type MigrationControlEvent = {
  id: string;
  control: string;
  shop: string;
  shop_name: string;
  domain: string;
  event_type: string;
  actor_user: string | null;
  actor_name: string | null;
  result: string;
  from_cutover_status: string;
  to_cutover_status: string;
  from_write_master: string;
  to_write_master: string;
  summary: string;
  metadata_json: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type MigrationShopCheckpointEvent = {
  id: string;
  shop: string;
  shop_name: string;
  shop_slug: string;
  actor_user: string | null;
  actor_name: string | null;
  decision:
    | "approved_for_cutover"
    | "hold_for_monitoring"
    | "rollback_escalated";
  overall_status_snapshot:
    | "blocked"
    | "ready_for_cutover"
    | "monitoring"
    | "production_safe"
    | "rollback_recommended";
  summary: string;
  recommended_action_snapshot: string;
  metadata_json: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type MigrationPhaseCheckpointEvent = {
  id: string;
  phase: string;
  actor_user: string | null;
  actor_name: string | null;
  decision:
    | "approved_for_next_phase"
    | "hold_for_monitoring"
    | "rollback_escalated";
  overall_status_snapshot:
    | "blocked"
    | "monitoring"
    | "ready_for_phase_exit"
    | "rollback_recommended";
  summary: string;
  recommended_action_snapshot: string;
  metadata_json: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type MigrationLaunchCheckpointEvent = {
  id: string;
  phase: string;
  actor_user: string | null;
  actor_name: string | null;
  decision:
    | "approved_for_launch"
    | "hold_for_hardening"
    | "rollback_to_phase4";
  overall_status_snapshot:
    | "blocked"
    | "monitoring"
    | "ready_for_launch"
    | "retirement_complete"
    | "rollback_recommended";
  summary: string;
  recommended_action_snapshot: string;
  metadata_json: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type MigrationShadowSummary = {
  shop: string;
  shop_name: string;
  shop_slug: string;
  domain: string;
  write_master: "firebase" | "postgres";
  bridge_mode: "disabled" | "compare_only" | "firebase_to_postgres" | "postgres_to_firebase";
  current_epoch: number;
  last_shadow_verified_at: string | null;
  latest_compare_status: "queued" | "running" | "succeeded" | "failed" | null;
  latest_compare_at: string | null;
  latest_compare_mismatches: number;
  latest_compare_trace_id: string | null;
  open_events: number;
  open_critical_events: number;
  open_stale_epoch_events: number;
};

export type MigrationPilotReadiness = {
  control_id: string;
  shop: string;
  shop_name: string;
  shop_slug: string;
  domain: string;
  cutover_status: "legacy" | "pilot" | "ready" | "postgres_primary";
  write_master: "firebase" | "postgres";
  bridge_mode: "disabled" | "compare_only" | "firebase_to_postgres" | "postgres_to_firebase";
  current_epoch: number;
  shadow_reads_enabled: boolean;
  last_backfill_at: string | null;
  last_shadow_verified_at: string | null;
  latest_compare_status: "queued" | "running" | "succeeded" | "failed" | null;
  latest_compare_at: string | null;
  latest_compare_mismatches: number;
  latest_compare_trace_id: string | null;
  open_events: number;
  open_critical_events: number;
  open_stale_epoch_events: number;
  ready_for_pilot: boolean;
  recommended_next_status: "legacy" | "pilot" | "ready" | "postgres_primary";
  blocking_reasons: string[];
  warnings: string[];
};

export type MigrationPilotSignoff = {
  control_id: string;
  shop: string;
  shop_name: string;
  shop_slug: string;
  domain: string;
  cutover_status: "legacy" | "pilot" | "ready" | "postgres_primary";
  write_master: "firebase" | "postgres";
  current_epoch: number;
  signoff_status:
    | "blocked"
    | "ready_for_cutover"
    | "monitoring"
    | "production_safe"
    | "rollback_recommended";
  latest_verify_result: string | null;
  latest_verified_at: string | null;
  latest_compare_status: "queued" | "running" | "succeeded" | "failed" | null;
  latest_compare_mismatches: number;
  open_critical_events: number;
  open_stale_epoch_events: number;
  ready_for_pilot: boolean;
  summary: string;
  recommended_action: string;
  blocking_reasons: string[];
  warnings: string[];
};

export type MigrationPilotShopScorecard = {
  shop: string;
  shop_name: string;
  shop_slug: string;
  overall_status:
    | "blocked"
    | "ready_for_cutover"
    | "monitoring"
    | "production_safe"
    | "rollback_recommended";
  recommended_action: string;
  summary: string;
  missing_domains: string[];
  production_safe_domains: number;
  ready_for_cutover_domains: number;
  monitoring_domains: number;
  blocked_domains: number;
  rollback_recommended_domains: number;
  domains: MigrationPilotSignoff[];
};

export type MigrationPhaseReadinessShop = {
  shop: string;
  shop_name: string;
  shop_slug: string;
  overall_status:
    | "blocked"
    | "ready_for_cutover"
    | "monitoring"
    | "production_safe"
    | "rollback_recommended";
  recommended_action: string;
  summary: string;
  latest_checkpoint_decision:
    | "approved_for_cutover"
    | "hold_for_monitoring"
    | "rollback_escalated"
    | null;
  latest_checkpoint_overall_status: string | null;
  latest_checkpoint_at: string | null;
};

export type MigrationPhaseReadiness = {
  phase: string;
  overall_status:
    | "blocked"
    | "monitoring"
    | "ready_for_phase_exit"
    | "rollback_recommended";
  pilot_shop_count: number;
  approved_for_cutover_count: number;
  hold_for_monitoring_count: number;
  rollback_escalated_count: number;
  shops_without_checkpoint: number;
  production_safe_shop_count: number;
  ready_for_cutover_shop_count: number;
  monitoring_shop_count: number;
  blocked_shop_count: number;
  rollback_recommended_shop_count: number;
  recommended_action: string;
  summary: string;
  shops: MigrationPhaseReadinessShop[];
};

export type MigrationRetirementDomainSnapshot = {
  domain: string;
  present: boolean;
  write_master: "firebase" | "postgres" | null;
  bridge_mode:
    | "disabled"
    | "compare_only"
    | "firebase_to_postgres"
    | "postgres_to_firebase"
    | null;
  cutover_status:
    | "legacy"
    | "pilot"
    | "ready"
    | "postgres_primary"
    | null;
};

export type MigrationRetirementShopScorecard = {
  shop: string;
  shop_name: string;
  shop_slug: string;
  overall_status:
    | "blocked"
    | "monitoring"
    | "ready_for_launch"
    | "rollback_recommended";
  recommended_action: string;
  summary: string;
  missing_domains: string[];
  postgres_primary_domains: number;
  firebase_primary_domains: number;
  active_bridge_domains: number;
  compare_only_domains: number;
  blocked_domains: number;
  open_events: number;
  open_critical_events: number;
  domains: MigrationRetirementDomainSnapshot[];
};

export type MigrationRetirementReadiness = {
  phase: string;
  overall_status:
    | "blocked"
    | "monitoring"
    | "ready_for_launch"
    | "retirement_complete"
    | "rollback_recommended";
  shop_count: number;
  ready_for_launch_shop_count: number;
  monitoring_shop_count: number;
  blocked_shop_count: number;
  rollback_recommended_shop_count: number;
  latest_launch_decision:
    | "approved_for_launch"
    | "hold_for_hardening"
    | "rollback_to_phase4"
    | null;
  latest_launch_status_snapshot: string | null;
  latest_launch_at: string | null;
  recommended_action: string;
  summary: string;
  shops: MigrationRetirementShopScorecard[];
};

export type MigrationPilotPreparationResult = {
  control_id: string;
  shop: string;
  shop_name: string;
  domain: string;
  jobs: MigrationJobRun[];
  readiness: MigrationPilotReadiness;
};

export type MigrationPilotVerificationResult = {
  control_id: string;
  shop: string;
  shop_name: string;
  domain: string;
  verification_job: MigrationJobRun;
  cutover_status: "legacy" | "pilot" | "ready" | "postgres_primary";
  write_master: "firebase" | "postgres";
  latest_compare_status: "queued" | "running" | "succeeded" | "failed" | null;
  latest_compare_mismatches: number;
  open_critical_events: number;
  open_stale_epoch_events: number;
  healthy: boolean;
  requires_rollback: boolean;
  operational_verdict:
    | "production_safe"
    | "monitoring"
    | "rollback_recommended";
  summary: string;
};

export type MigrationReconciliationEvent = {
  id: string;
  shop: string;
  shop_name: string;
  domain: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved" | "ignored";
  issue_code: string;
  entity_type: string;
  entity_id: string;
  source_reference: string;
  expected_master: string;
  observed_source: string;
  occurred_at: string;
  mismatch_payload_json: Record<string, unknown>;
  note: string;
  resolver_user: string | null;
  resolver_name: string | null;
  resolved_at: string | null;
  resolution_note: string;
  created_at: string;
  updated_at: string;
};

export type MigrationStats = {
  totalControls: number;
  postgresPrimaryDomains: number;
  activeBridgeDomains: number;
  bridgeReceipts: number;
  pilotReadyDomains: number;
  openCriticalEvents: number;
  openStaleEpochEvents: number;
  runningJobs: number;
};
