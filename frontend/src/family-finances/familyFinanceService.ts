import { apiRequest } from "../api/http";
import type {
  AllowanceEntry,
  CategoryComparison,
  CreateAllowancePayload,
  CreateFamilyMemberPayload,
  CreateSpendPayload,
  FamilyComparisonSummary,
  FamilyFilters,
  FamilyMember,
  PayerBreakdown,
  SpendEntry,
} from "./types";

const FAMILY_BASE = "/api/family-finances";

function buildQueryParams(filters: FamilyFilters): string {
  const params = new URLSearchParams();

  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.member) {
    params.set("member", String(filters.member));
  }
  if (filters.kind) {
    params.set("kind", filters.kind);
  }
  if (filters.payer) {
    params.set("payer", filters.payer);
  }
  if (filters.significantOnly) {
    params.set("significant_only", "true");
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listFamilyMembers(): Promise<FamilyMember[]> {
  return apiRequest<FamilyMember[]>(`${FAMILY_BASE}/members/`);
}

export function createFamilyMember(payload: CreateFamilyMemberPayload): Promise<FamilyMember> {
  return apiRequest<FamilyMember>(
    `${FAMILY_BASE}/members/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function listAllowanceEntries(filters: FamilyFilters = {}): Promise<AllowanceEntry[]> {
  return apiRequest<AllowanceEntry[]>(`${FAMILY_BASE}/allowances/${buildQueryParams(filters)}`);
}

export function createAllowanceEntry(payload: CreateAllowancePayload): Promise<AllowanceEntry> {
  return apiRequest<AllowanceEntry>(
    `${FAMILY_BASE}/allowances/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function listSpendEntries(filters: FamilyFilters = {}): Promise<SpendEntry[]> {
  return apiRequest<SpendEntry[]>(`${FAMILY_BASE}/spend/${buildQueryParams(filters)}`);
}

export function createSpendEntry(payload: CreateSpendPayload): Promise<SpendEntry> {
  return apiRequest<SpendEntry>(
    `${FAMILY_BASE}/spend/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function getFamilyComparisonSummary(filters: FamilyFilters = {}): Promise<FamilyComparisonSummary> {
  return apiRequest<FamilyComparisonSummary>(`${FAMILY_BASE}/comparison/summary/${buildQueryParams(filters)}`);
}

export function getPayerBreakdown(filters: FamilyFilters = {}): Promise<PayerBreakdown> {
  return apiRequest<PayerBreakdown>(`${FAMILY_BASE}/comparison/payer-breakdown/${buildQueryParams(filters)}`);
}

export function getCategoryComparison(filters: FamilyFilters = {}): Promise<CategoryComparison> {
  return apiRequest<CategoryComparison>(`${FAMILY_BASE}/comparison/category/${buildQueryParams(filters)}`);
}
