import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { ApiRequestError } from "../api/http";
import { bootstrapCsrf, getCurrentUser, login, logout } from "../auth/authService";
import LoginForm from "../auth/components/LoginForm";
import type { AuthUser } from "../auth/types";
import {
  createAllowanceEntry,
  createFamilyMember,
  createSpendEntry,
  getCategoryComparison,
  getFamilyComparisonSummary,
  getPayerBreakdown,
  listAllowanceEntries,
  listFamilyMembers,
  listSpendEntries,
} from "./familyFinanceService";
import type {
  AllowanceEntry,
  CategoryComparison,
  FamilyComparisonSummary,
  FamilyFilters,
  FamilyMember,
  FamilyMemberRole,
  FamilySpendKind,
  FamilySpendPayer,
  PayerBreakdown,
  SpendEntry,
} from "./types";

interface LoginErrorData {
  detail?: string;
  attempts_left?: number;
  locked_out?: boolean;
  lockout_minutes?: number;
}

const FAMILY_FINANCES_SECTION = "family-finances";

type FamilyTab = "members" | "allowances" | "spend" | "comparison";

const defaultComparisonSummary: FamilyComparisonSummary = { members: [] };
const defaultPayerBreakdown: PayerBreakdown = {
  overall_parent_paid_total: "0.00",
  overall_child_paid_total: "0.00",
  members: [],
};
const defaultCategoryComparison: CategoryComparison = { members: [] };

function canAccessFamilyFinances(user: AuthUser): boolean {
  return user.allowed_sections.includes(FAMILY_FINANCES_SECTION);
}

function FamilyFinancesPage() {
  const [username, setUsername] = useState("testuser");
  const [password, setPassword] = useState("StrongPassword123!");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [activeTab, setActiveTab] = useState<FamilyTab>("members");

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [allowances, setAllowances] = useState<AllowanceEntry[]>([]);
  const [spendEntries, setSpendEntries] = useState<SpendEntry[]>([]);
  const [comparison, setComparison] = useState<FamilyComparisonSummary>(defaultComparisonSummary);
  const [payerBreakdown, setPayerBreakdown] = useState<PayerBreakdown>(defaultPayerBreakdown);
  const [categoryComparison, setCategoryComparison] = useState<CategoryComparison>(defaultCategoryComparison);
  const [dataStatus, setDataStatus] = useState("No family finance data loaded yet.");

  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<FamilyMemberRole>("child");

  const [allowanceMemberId, setAllowanceMemberId] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState("");
  const [allowanceDate, setAllowanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [allowanceNotes, setAllowanceNotes] = useState("");

  const [spendMemberId, setSpendMemberId] = useState("");
  const [spendKind, setSpendKind] = useState<FamilySpendKind>("significant_purchase");
  const [spendTitle, setSpendTitle] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [spendDate, setSpendDate] = useState(new Date().toISOString().slice(0, 10));
  const [spendPayer, setSpendPayer] = useState<FamilySpendPayer>("parent");
  const [spendManualSignificant, setSpendManualSignificant] = useState(false);
  const [spendNotes, setSpendNotes] = useState("");

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterMemberId, setFilterMemberId] = useState("");
  const [filterKind, setFilterKind] = useState<FamilySpendKind | "">("");
  const [filterPayer, setFilterPayer] = useState<FamilySpendPayer | "">("");
  const [filterSignificantOnly, setFilterSignificantOnly] = useState(false);

  const formatMoney = (value: string): string => {
    const numericAmount = Number(value);
    if (!Number.isFinite(numericAmount)) {
      return value;
    }
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(numericAmount);
  };

  const activeChildMembers = useMemo(
    () => members.filter((member) => member.role === "child" && member.is_active),
    [members],
  );

  const buildFilters = (): FamilyFilters => {
    const filters: FamilyFilters = {};

    if (filterFrom) {
      filters.from = filterFrom;
    }
    if (filterTo) {
      filters.to = filterTo;
    }
    if (filterMemberId) {
      filters.member = Number(filterMemberId);
    }
    if (filterKind) {
      filters.kind = filterKind;
    }
    if (filterPayer) {
      filters.payer = filterPayer;
    }
    if (filterSignificantOnly) {
      filters.significantOnly = true;
    }

    return filters;
  };

  const loadFamilyData = async (filters: FamilyFilters = buildFilters()) => {
    try {
      const [nextMembers, nextAllowances, nextSpendEntries, nextComparison, nextPayerBreakdown, nextCategoryComparison] =
        await Promise.all([
          listFamilyMembers(),
          listAllowanceEntries(filters),
          listSpendEntries(filters),
          getFamilyComparisonSummary(filters),
          getPayerBreakdown(filters),
          getCategoryComparison(filters),
        ]);

      setMembers(nextMembers);
      setAllowances(nextAllowances);
      setSpendEntries(nextSpendEntries);
      setComparison(nextComparison);
      setPayerBreakdown(nextPayerBreakdown);
      setCategoryComparison(nextCategoryComparison);
      setDataStatus("Family finance data loaded.");
    } catch {
      setDataStatus("Failed to load family finance data.");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        await bootstrapCsrf();
        const user = await getCurrentUser();
        if (!canAccessFamilyFinances(user)) {
          setStatus("Your account is not allowed to access the Family Finances section.");
          return;
        }
        setCurrentUser(user);
        setStatus(`Signed in as ${user.username}`);
        await loadFamilyData();
      } catch {
        setStatus("Not signed in");
      }
    };

    void initialize();
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    try {
      const user = await login({ username, password });
      if (!canAccessFamilyFinances(user)) {
        setStatus("Your account is not allowed to access the Family Finances section.");
        return;
      }
      setCurrentUser(user);
      setStatus(`Signed in as ${user.username}`);
      await loadFamilyData();
    } catch (error) {
      if (error instanceof ApiRequestError && error.data && typeof error.data === "object") {
        const data = error.data as LoginErrorData;

        if (data.locked_out) {
          const lockoutMinutes = typeof data.lockout_minutes === "number" ? data.lockout_minutes : 60;
          setStatus(`Too many failed attempts. Your account is locked for ${lockoutMinutes} minute(s).`);
          return;
        }

        if (typeof data.attempts_left === "number" && data.attempts_left < 3) {
          setStatus(
            `Login failed. ${data.attempts_left} attempt(s) left before temporary lockout.`,
          );
          return;
        }

        if (typeof data.detail === "string" && data.detail.length > 0) {
          setStatus(data.detail);
          return;
        }
      }

      setStatus("Login failed. Check credentials.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setStatus("Signed out");
      setMembers([]);
      setAllowances([]);
      setSpendEntries([]);
      setComparison(defaultComparisonSummary);
      setPayerBreakdown(defaultPayerBreakdown);
      setCategoryComparison(defaultCategoryComparison);
      setDataStatus("Signed out.");
    } catch {
      setStatus("Logout failed");
    }
  };

  const handleCreateMember = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createFamilyMember({
        name: memberName,
        role: memberRole,
        is_active: true,
      });
      setMemberName("");
      setMemberRole("child");
      await loadFamilyData();
      setDataStatus("Member added.");
    } catch {
      setDataStatus("Failed to add member.");
    }
  };

  const handleCreateAllowance = async (event: FormEvent) => {
    event.preventDefault();
    if (!allowanceMemberId) {
      setDataStatus("Please choose a child for allowance entry.");
      return;
    }
    try {
      await createAllowanceEntry({
        member: Number(allowanceMemberId),
        amount: allowanceAmount,
        received_at: allowanceDate,
        notes: allowanceNotes,
      });
      setAllowanceAmount("");
      setAllowanceNotes("");
      await loadFamilyData();
      setDataStatus("Allowance entry added.");
    } catch {
      setDataStatus("Failed to add allowance entry.");
    }
  };

  const handleCreateSpend = async (event: FormEvent) => {
    event.preventDefault();
    if (!spendMemberId) {
      setDataStatus("Please choose a child for spend entry.");
      return;
    }
    try {
      await createSpendEntry({
        member: Number(spendMemberId),
        kind: spendKind,
        title: spendTitle,
        amount: spendAmount,
        spent_at: spendDate,
        payer: spendPayer,
        manual_significant: spendManualSignificant,
        notes: spendNotes,
      });
      setSpendTitle("");
      setSpendAmount("");
      setSpendNotes("");
      setSpendManualSignificant(false);
      await loadFamilyData();
      setDataStatus("Spend entry added.");
    } catch {
      setDataStatus("Failed to add spend entry.");
    }
  };

  const handleApplyFilters = async (event: FormEvent) => {
    event.preventDefault();
    await loadFamilyData(buildFilters());
  };

  return (
    <main className="dashboard">
      <header className="panel stack-sm">
        <h1>Family Finances</h1>
        <p>{status}</p>
        <p>{dataStatus}</p>
      </header>

      {!currentUser ? (
        <LoginForm
          username={username}
          password={password}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onSubmit={handleLogin}
        />
      ) : (
        <>
          <section className="panel stack-sm session-panel">
            <h2>Welcome, {currentUser.username}</h2>
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </section>

          <section className="panel stack-sm">
            <div className="tab-bar">
              {[
                { key: "members", label: "Members" },
                { key: "allowances", label: "Allowances" },
                { key: "spend", label: "Spend" },
                { key: "comparison", label: "Comparison" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.key as FamilyTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form className="filter-form" onSubmit={handleApplyFilters}>
              <div className="filter-field filter-inline-field">
                <label htmlFor="family-filter-from">From</label>
                <input
                  id="family-filter-from"
                  type="date"
                  value={filterFrom}
                  onChange={(event) => setFilterFrom(event.target.value)}
                />
              </div>
              <div className="filter-field filter-inline-field">
                <label htmlFor="family-filter-to">To</label>
                <input
                  id="family-filter-to"
                  type="date"
                  value={filterTo}
                  onChange={(event) => setFilterTo(event.target.value)}
                />
              </div>
              <div className="filter-field filter-inline-field">
                <label htmlFor="family-filter-member">Member</label>
                <select
                  id="family-filter-member"
                  value={filterMemberId}
                  onChange={(event) => setFilterMemberId(event.target.value)}
                >
                  <option value="">All members</option>
                  {activeChildMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field filter-inline-field">
                <label htmlFor="family-filter-kind">Spend type</label>
                <select
                  id="family-filter-kind"
                  value={filterKind}
                  onChange={(event) => setFilterKind(event.target.value as FamilySpendKind | "")}
                >
                  <option value="">All types</option>
                  <option value="significant_purchase">Significant purchase</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>
              <div className="filter-field filter-inline-field">
                <label htmlFor="family-filter-payer">Payer</label>
                <select
                  id="family-filter-payer"
                  value={filterPayer}
                  onChange={(event) => setFilterPayer(event.target.value as FamilySpendPayer | "")}
                >
                  <option value="">All payers</option>
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                </select>
              </div>
              <div className="filter-field filter-inline-field">
                <label htmlFor="family-filter-significant">Significant only</label>
                <input
                  id="family-filter-significant"
                  type="checkbox"
                  checked={filterSignificantOnly}
                  onChange={(event) => setFilterSignificantOnly(event.target.checked)}
                />
              </div>
              <button type="submit" className="filter-actions">
                Apply filters
              </button>
            </form>
          </section>

          {activeTab === "members" && (
            <section className="panel panel-grid">
              <div className="panel">
                <h2>Add Family Member</h2>
                <form onSubmit={handleCreateMember}>
                  <label htmlFor="member-name">Name</label>
                  <input
                    id="member-name"
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    required
                  />

                  <label htmlFor="member-role">Role</label>
                  <select
                    id="member-role"
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value as FamilyMemberRole)}
                  >
                    <option value="child">Child</option>
                    <option value="parent">Parent</option>
                  </select>

                  <button type="submit">Save Member</button>
                </form>
              </div>

              <div className="panel">
                <h2>Members</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>{member.role}</td>
                        <td>{member.is_active ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "allowances" && (
            <section className="panel panel-grid">
              <div className="panel">
                <h2>Add Allowance</h2>
                <form onSubmit={handleCreateAllowance}>
                  <label htmlFor="allowance-member">Child</label>
                  <select
                    id="allowance-member"
                    value={allowanceMemberId}
                    onChange={(event) => setAllowanceMemberId(event.target.value)}
                    required
                  >
                    <option value="">Select child</option>
                    {activeChildMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="allowance-amount">Amount</label>
                  <input
                    id="allowance-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={allowanceAmount}
                    onChange={(event) => setAllowanceAmount(event.target.value)}
                    required
                  />

                  <label htmlFor="allowance-date">Received at</label>
                  <input
                    id="allowance-date"
                    type="date"
                    value={allowanceDate}
                    onChange={(event) => setAllowanceDate(event.target.value)}
                    required
                  />

                  <label htmlFor="allowance-notes">Notes</label>
                  <textarea
                    id="allowance-notes"
                    value={allowanceNotes}
                    onChange={(event) => setAllowanceNotes(event.target.value)}
                  />

                  <button type="submit">Save Allowance</button>
                </form>
              </div>

              <div className="panel">
                <h2>Allowance Entries</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Child</th>
                      <th>Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowances.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.member_name}</td>
                        <td>{formatMoney(entry.amount)}</td>
                        <td>{entry.received_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "spend" && (
            <section className="panel panel-grid">
              <div className="panel">
                <h2>Add Spend Entry</h2>
                <form onSubmit={handleCreateSpend}>
                  <label htmlFor="spend-member">Child</label>
                  <select
                    id="spend-member"
                    value={spendMemberId}
                    onChange={(event) => setSpendMemberId(event.target.value)}
                    required
                  >
                    <option value="">Select child</option>
                    {activeChildMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="spend-kind">Type</label>
                  <select
                    id="spend-kind"
                    value={spendKind}
                    onChange={(event) => setSpendKind(event.target.value as FamilySpendKind)}
                  >
                    <option value="significant_purchase">Significant purchase</option>
                    <option value="holiday">Holiday</option>
                  </select>

                  <label htmlFor="spend-title">Title</label>
                  <input
                    id="spend-title"
                    value={spendTitle}
                    onChange={(event) => setSpendTitle(event.target.value)}
                    required
                  />

                  <label htmlFor="spend-amount">Amount</label>
                  <input
                    id="spend-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={spendAmount}
                    onChange={(event) => setSpendAmount(event.target.value)}
                    required
                  />

                  <label htmlFor="spend-date">Date</label>
                  <input
                    id="spend-date"
                    type="date"
                    value={spendDate}
                    onChange={(event) => setSpendDate(event.target.value)}
                    required
                  />

                  <label htmlFor="spend-payer">Who paid</label>
                  <select
                    id="spend-payer"
                    value={spendPayer}
                    onChange={(event) => setSpendPayer(event.target.value as FamilySpendPayer)}
                  >
                    <option value="parent">Parent</option>
                    <option value="child">Child</option>
                  </select>

                  <label htmlFor="spend-significant">Manually mark as significant</label>
                  <input
                    id="spend-significant"
                    type="checkbox"
                    checked={spendManualSignificant}
                    onChange={(event) => setSpendManualSignificant(event.target.checked)}
                  />

                  <label htmlFor="spend-notes">Notes</label>
                  <textarea
                    id="spend-notes"
                    value={spendNotes}
                    onChange={(event) => setSpendNotes(event.target.value)}
                  />

                  <button type="submit">Save Spend Entry</button>
                </form>
              </div>

              <div className="panel">
                <h2>Spend Entries</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Child</th>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Who paid</th>
                      <th>Amount</th>
                      <th>Significant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spendEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.member_name}</td>
                        <td>{entry.kind === "holiday" ? "Holiday" : "Significant purchase"}</td>
                        <td>{entry.title}</td>
                        <td>{entry.payer}</td>
                        <td>{formatMoney(entry.amount)}</td>
                        <td>{entry.effective_significant ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "comparison" && (
            <section className="panel stack-sm">
              <div className="summary-grid">
                <article className="summary-card">
                  <h3>Parent Paid Total</h3>
                  <p className="summary-value">{formatMoney(payerBreakdown.overall_parent_paid_total)}</p>
                </article>
                <article className="summary-card">
                  <h3>Child Paid Total</h3>
                  <p className="summary-value">{formatMoney(payerBreakdown.overall_child_paid_total)}</p>
                </article>
              </div>

              <h2>Member Comparison</h2>
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Allowance</th>
                    <th>Purchase Spend</th>
                    <th>Holiday Spend</th>
                    <th>Parent Paid</th>
                    <th>Child Paid</th>
                    <th>Net Position</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.members.map((row) => (
                    <tr key={row.member_id}>
                      <td>{row.member_name}</td>
                      <td>{formatMoney(row.allowance_received)}</td>
                      <td>{formatMoney(row.purchase_spend)}</td>
                      <td>{formatMoney(row.holiday_spend)}</td>
                      <td>{formatMoney(row.parent_paid_total)}</td>
                      <td>{formatMoney(row.child_paid_total)}</td>
                      <td>{formatMoney(row.net_position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2>Spend by Type</h2>
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Significant Purchases</th>
                    <th>Holiday Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryComparison.members.map((row) => (
                    <tr key={row.member_id}>
                      <td>{row.member_name}</td>
                      <td>{formatMoney(row.significant_purchase_total)}</td>
                      <td>{formatMoney(row.holiday_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default FamilyFinancesPage;
