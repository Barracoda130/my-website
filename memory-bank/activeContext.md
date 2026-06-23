# Active Context

## Current Work Focus
The Budget Tracker foundation MVP has been implemented. The project now has a working personal budgeting module with backend models/API and a single-page frontend MVP. Family Finances remains an empty stub waiting to be built out.

## Recent Changes
- Memory Bank initialised (all core files created) — 2026-06-22
- Budget Tracker foundation MVP implemented — 2026-06-22
  - Added backend models/admin/API for category groups, categories, accounts, transactions, monthly budgets, and recurring items
  - Added `/api/budget/summary/` and `/api/budget/bootstrap-defaults/`
  - Added `frontend/src/api/budget.js`
  - Replaced `BudgetTracker.jsx` stub with a usable MVP page
  - Created and applied `budget_tracker.0001_initial` migration
  - Verified `python manage.py check`, `npm run lint`, and `npm run build`

## Current State of the App
### What is complete and working
- Full JWT authentication flow (login, logout, token refresh, token blacklisting)
- Invite-only registration with single-use UUID tokens
- `AuthContext` providing global auth state to the React app
- `ProtectedRoute` and `ModuleRoute` route guards
- Dashboard page showing module cards based on user's granted access
- `UserGroup` model for collaborative module data sharing (backend only, not yet wired to any module)
- Django admin for managing users, invite tokens, module access, and groups
- Budget Tracker backend models, serializers, views, URLs, admin, and migration
- Budget Tracker frontend MVP with summary cards, default setup, manual transactions, monthly budgets, setup forms, and recurring item list/form

### What is a stub / not yet implemented
- `family_finances` Django app — models, views, and URLs are empty
- `FamilyFinances.jsx` frontend page — stub

## Next Steps (likely)
1. Improve the **Budget Tracker** module after MVP feedback:
   - Add edit forms/modals for transactions, categories, accounts, budgets, and recurring items
   - Add delete confirmations and better field-level validation display
   - Add CSV export/import, transaction splitting, calendar view, savings goals, and reports in later phases
2. Implement the **Family Finances** module:
   - Leverage `UserGroup` for shared data between household members
   - Design models for shared expenses, contributions, etc.
   - Build frontend page
3. Production hardening (when ready to deploy):
   - Move `SECRET_KEY` to environment variable
   - Switch `DEBUG = False`
   - Replace SQLite with PostgreSQL
   - Move tokens from `localStorage` to httpOnly cookies (optional security improvement)

## Active Decisions & Considerations
- Module slugs (`budget_tracker`, `family_finances`) are the single source of truth — they must match exactly between `AVAILABLE_MODULES` (backend), `MODULE_INFO` (frontend Dashboard), and `ModuleRoute moduleSlug` props
- The `UserGroup` model is already in place for Family Finances shared data — use it when building that module
- Tailwind CSS v4 is used via the `@tailwindcss/vite` plugin (not the PostCSS plugin) — no `tailwind.config.js` file needed
- Budget Tracker is intentionally personal-user scoped. Shared household budgeting should be added later either in Family Finances or via deliberate group-aware extensions.
- Budget Tracker backend endpoints check both JWT auth and `UserModuleAccess(module='budget_tracker')`; frontend route guards are not treated as the only security boundary.
- Budget Tracker backend access is implemented through `budget_tracker.permissions.HasBudgetTrackerAccess`, used in view decorators via `@permission_classes([HasBudgetTrackerAccess])`.
- Django `User` is extended in `users/models.py` with `has_module_access(module_name)`, which centralises module access lookup for backend code.
- Budget Tracker money values use Django `DecimalField`; frontend formats values for display with `£`.

## Important Patterns & Preferences
- UI style: clean minimal — white cards (`bg-white rounded-2xl border border-gray-200`), gray page backgrounds (`bg-gray-50`), blue primary actions (`bg-blue-600`)
- All async actions should have loading states and inline error messages
- API functions live in `frontend/src/api/` — keep them separate from components
- Backend views use `@api_view` + `@permission_classes` decorators (function-based views), not class-based views
- The React lint setup includes strict React 19 hook rules; avoid direct synchronous state updates in effect bodies where the linter flags them.
