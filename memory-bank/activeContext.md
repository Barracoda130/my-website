# Active Context

## Current Work Focus
The Memory Bank has just been initialised. The project has a fully working authentication and module-access scaffolding, but the two feature modules (Budget Tracker and Family Finances) are empty stubs waiting to be built out.

## Recent Changes
- Memory Bank initialised (all core files created) — 2026-06-22

## Current State of the App
### What is complete and working
- Full JWT authentication flow (login, logout, token refresh, token blacklisting)
- Invite-only registration with single-use UUID tokens
- `AuthContext` providing global auth state to the React app
- `ProtectedRoute` and `ModuleRoute` route guards
- Dashboard page showing module cards based on user's granted access
- `UserGroup` model for collaborative module data sharing (backend only, not yet wired to any module)
- Django admin for managing users, invite tokens, module access, and groups

### What is a stub / not yet implemented
- `budget_tracker` Django app — models, views, and URLs are empty
- `family_finances` Django app — models, views, and URLs are empty
- `BudgetTracker.jsx` frontend page — stub
- `FamilyFinances.jsx` frontend page — stub

## Next Steps (likely)
1. Implement the **Budget Tracker** module:
   - Design and create Django models (e.g. `Transaction`, `Category`, `Budget`)
   - Build DRF serializers and views (CRUD for transactions/budgets)
   - Add URL patterns to `budget_tracker/urls.py`
   - Build out `BudgetTracker.jsx` frontend page with API integration
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

## Important Patterns & Preferences
- UI style: clean minimal — white cards (`bg-white rounded-2xl border border-gray-200`), gray page backgrounds (`bg-gray-50`), blue primary actions (`bg-blue-600`)
- All async actions should have loading states and inline error messages
- API functions live in `frontend/src/api/` — keep them separate from components
- Backend views use `@api_view` + `@permission_classes` decorators (function-based views), not class-based views
