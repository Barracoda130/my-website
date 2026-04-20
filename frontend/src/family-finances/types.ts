export type FamilyMemberRole = "parent" | "child";
export type FamilySpendKind = "significant_purchase" | "holiday";
export type FamilySpendPayer = "parent" | "child";

export interface FamilyMember {
  id: number;
  name: string;
  role: FamilyMemberRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AllowanceEntry {
  id: number;
  member: number;
  member_name: string;
  amount: string;
  received_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SpendEntry {
  id: number;
  member: number;
  member_name: string;
  kind: FamilySpendKind;
  title: string;
  amount: string;
  spent_at: string;
  payer: FamilySpendPayer;
  manual_significant: boolean;
  threshold_significant: boolean;
  effective_significant: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyComparisonRow {
  member_id: number;
  member_name: string;
  allowance_received: string;
  purchase_spend: string;
  holiday_spend: string;
  parent_paid_total: string;
  child_paid_total: string;
  net_position: string;
}

export interface FamilyComparisonSummary {
  members: FamilyComparisonRow[];
}

export interface PayerBreakdownRow {
  member_id: number;
  member_name: string;
  parent_paid_total: string;
  child_paid_total: string;
}

export interface PayerBreakdown {
  overall_parent_paid_total: string;
  overall_child_paid_total: string;
  members: PayerBreakdownRow[];
}

export interface CategoryComparisonRow {
  member_id: number;
  member_name: string;
  significant_purchase_total: string;
  holiday_total: string;
}

export interface CategoryComparison {
  members: CategoryComparisonRow[];
}

export interface FamilyFilters {
  from?: string;
  to?: string;
  member?: number;
  kind?: FamilySpendKind;
  payer?: FamilySpendPayer;
  significantOnly?: boolean;
}

export interface CreateFamilyMemberPayload {
  name: string;
  role: FamilyMemberRole;
  is_active: boolean;
}

export interface CreateAllowancePayload {
  member: number;
  amount: string;
  received_at: string;
  notes?: string;
}

export interface CreateSpendPayload {
  member: number;
  kind: FamilySpendKind;
  title: string;
  amount: string;
  spent_at: string;
  payer: FamilySpendPayer;
  manual_significant?: boolean;
  notes?: string;
}
