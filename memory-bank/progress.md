# Progress

## What Works
- ✅ Django project structure with `config`, `users`, `budget_tracker`, `family_finances` apps
- ✅ JWT authentication: login (`/api/auth/login/`), token refresh (`/api/auth/token/refresh/`), logout with blacklisting (`/api/auth/logout/`)
- ✅ Invite-only registration: token validation (`/api/auth/invite/validate/`) + registration (`/api/auth/register/`)
- ✅ Current user endpoints: `/api/auth/me/`, `/api/auth/me/modules/`, `/api/auth/me/groups/`
- ✅ `UserProfile`, `InviteToken`, `UserModuleAccess`, `UserGroup` models with migrations
- ✅ Django admin registration for all models
- ✅ CORS configured for Vite dev server (`localhost:5173`)
- ✅ React app with Vite + Tailwind CSS v4
- ✅ `AuthContext` — global auth state, login/logout, module access check
- ✅ Axios client with JWT request interceptor + 401 auto-refresh response interceptor
- ✅ `ProtectedRoute` — redirects unauthenticated users to `/login` with return-path preservation
- ✅ `ModuleRoute` — redirects users without module access to `/unauthorized`
- ✅ Login page with error handling
- ✅ Register page with invite token validation, field-level error display, auto-login after registration
- ✅ Dashboard page with dynamic module cards based on user's access
- ✅ Unauthorized page (`/unauthorized`)
- ✅ Not Found page (`*` route)
- ✅ Route structure: `/`, `/login`, `/register`, `/dashboard`, `/budget`, `/family`
- ✅ Budget Tracker models: `CategoryGroup`, `Category`, `Account`, `Transaction`, `Budget`, `RecurringItem`
- ✅ Budget Tracker admin registration
- ✅ Budget Tracker serializers and function-based DRF views
- ✅ Budget Tracker API URLs under `/api/budget/`
- ✅ Budget Tracker module access enforcement on backend endpoints
- ✅ Budget Tracker bootstrap defaults endpoint
- ✅ Budget Tracker monthly summary endpoint
- ✅ Budget Tracker frontend API layer in `frontend/src/api/budget.js`
- ✅ Budget Tracker MVP page with setup, summary cards, manual transaction entry/list, monthly budgets, and recurring items
- ✅ Backend migration `budget_tracker.0001_initial` created and applied
- ✅ Backend `python manage.py check` passes
- ✅ Frontend `npm run lint` and `npm run build` pass
- ✅ Budget Tracker transaction descriptions are optional (`budget_tracker.0002_alter_transaction_description` applied)
- ✅ Budget Tracker/Dashboard buttons have clearer hover states and pointer cursors
- ✅ Backend pytest setup added with automatic isolated in-memory SQLite test database (`config.test_settings` via `backend/pytest.ini`)
- ✅ Backend security tests added for Budget Tracker module access, per-user data isolation, cross-user relationship validation, and auth/current-user privacy
- ✅ `cd backend; pytest` passes: 15 tests passing
- ✅ Budget Tracker frontend split into `frontend/src/pages/modules/budget/`
- ✅ `/budget` is now a view-only Budget dashboard
- ✅ `/budget/manage` contains Budget Tracker add/edit/delete/setup workflows with focused section navigation
- ✅ Shared Budget Tracker frontend hook/helpers added (`useBudgetData.js`, `helpers.js`)
- ✅ Frontend ESLint now ignores generated `.vite` cache
- ✅ `cd frontend; npm run lint; npm run build` passes after Budget Tracker split
- ✅ Monthly budget panel clearly highlights overbudget categories
- ✅ Recurring items show relative due status (`due today`, `in x days`, overdue text)
- ✅ Recurring item form clearly labels `First payment date` and `Frequency`
- ✅ Budget manage actions show inline success feedback underneath the triggering button/action
- ✅ `cd frontend; npm run lint; npm run build` passes after Budget Tracker UX polish
- ✅ Budget Tracker simplified yearly planner added at `/budget/yearly`
- ✅ Yearly planner supports custom start month/year for a rolling 12-month planning period
- ✅ Yearly planner shows existing category groups/categories in a spreadsheet-style grouped layout
- ✅ Yearly planner supports inline expense category group creation
- ✅ Yearly planner supports inline category creation directly inside a category group
- ✅ Yearly planner includes a proper Income section with add-income rows, weekly/monthly/yearly frequency, and taxed toggles
- ✅ Yearly planner calculates estimated tax on taxed income rows and shows income after tax in totals
- ✅ Yearly planner lets each category use weekly/monthly/yearly pricing and converts that to monthly budgets for saving
- ✅ Yearly planner has one global weekly/monthly/yearly display toggle for all group subtotals
- ✅ Yearly planner includes a bottom summary table for total income, each expense group, total expenses, and net total
- ✅ Yearly planner aligns existing rows, add-new rows, tax rows, and subtotal rows to consistent columns ordered name, taxed (income only), frequency, amount, actions
- ✅ Yearly planner supports deleting categories and expense category groups from the planner page
- ✅ Yearly planner saves only monthly-equivalent category budget allocations to the existing `Budget` table
- ✅ Backend yearly-plan security tests added; `cd backend; python manage.py check; pytest` passes with 17 tests
- ✅ Frontend `npm run lint` and `npm run build` pass after yearly planner implementation

## What's Left to Build

### Budget Tracker Module
- [x] Django models (category groups, categories, accounts, transactions, budgets, recurring items)
- [x] DRF serializers + views (CRUD-style endpoints)
- [x] URL patterns in `budget_tracker/urls.py`
- [x] Frontend `BudgetTracker.jsx` MVP page
- [x] Split Budget Tracker frontend into view-only dashboard and separate management page
- [x] API functions in `frontend/src/api/budget.js`
- [x] Overbudget warnings in monthly budgets panel
- [x] Relative due text for recurring items
- [x] Clear recurring item first payment/frequency fields
- [x] Inline success feedback for manage actions
- [x] Simplified yearly planner with grouped category rows, inline group/category/income creation, deletion actions, income tax planning, summary table, and frequency-based calculations
- [ ] Edit UI for existing records
- [ ] Better field-level validation display
- [ ] Delete confirmations
- [ ] CSV import/export
- [ ] Transaction splitting
- [ ] Calendar view
- [ ] Savings goals/sinking funds
- [ ] Custom reports/date ranges

### Family Finances Module
- [ ] Django models (shared expenses, contributions — using `UserGroup` for multi-user data)
- [ ] DRF serializers + views (CRUD)
- [ ] URL patterns in `family_finances/urls.py`
- [ ] Frontend `FamilyFinances.jsx` page (currently a stub)
- [ ] API functions in `frontend/src/api/` for family finance endpoints

### Production Readiness
- [ ] Move `SECRET_KEY` to environment variable (`.env` file)
- [ ] Set `DEBUG = False` for production
- [ ] Configure `ALLOWED_HOSTS` for production domain
- [ ] Switch from SQLite to PostgreSQL
- [ ] Set up static file serving (WhiteNoise or CDN)
- [ ] Add `STATIC_ROOT` and run `collectstatic`
- [ ] Consider moving JWT tokens from `localStorage` to httpOnly cookies

## Current Status
**Phase**: Core scaffolding complete. Budget Tracker foundation MVP plus rolling yearly planner implemented. Ready for further Budget Tracker polish or Family Finances implementation.

## Known Issues / Notes
- `SECRET_KEY` in `settings.py` is a placeholder — must be changed before any production deployment
- API base URL is hardcoded in two places (`client.js` and `auth.js`) — consider extracting to a shared constant or environment variable
- Backend security tests now exist for the implemented auth/Budget Tracker areas; broader feature/regression tests are still needed as modules grow
- `db.sqlite3` is present in the repo root of `backend/` — ensure it stays gitignored
- Budget Tracker MVP currently has create/delete flows but limited edit functionality in the UI
- Budget Tracker recurring items are “upcoming visibility” only; they do not yet auto-create transactions
- Budget Tracker frontend has been split into a view-only dashboard and focused management page, but individual management sections may still benefit from component extraction as features grow
- Budget Tracker success confirmations are currently local inline messages, not a shared notification component; consider extraction if reused elsewhere
- Button hover/cursor affordances were improved after MVP feedback
- The yearly planner's UK income tax estimate is planning-only and currently covers income tax bands/allowance, not National Insurance, pension, student loan, or benefits calculations
- Yearly planner category frequency choices are currently UI-only; persisted budget output is monthly-equivalent `Budget` rows
- Yearly planner income amounts and taxed toggles are currently planning-only; newly added income categories are persisted, but their planner amounts are not persisted after reload

## Evolution of Decisions
- **2026-06-22**: Project scaffolded with full auth system and module access control. Memory Bank initialised.
- **2026-06-22**: Budget Tracker foundation MVP implemented as a personal, manual-first budgeting module. Advanced researched features such as CSV import/export, splitting, calendar views, savings goals, custom reports, rules, shared budgeting, and bank sync were deliberately deferred but the model shape supports later expansion.
- **2026-06-23**: Added initial backend security test suite and pytest configuration. Tests run against `config.test_settings` automatically, using an in-memory SQLite test database rather than the application database.
- **2026-06-23**: Split Budget Tracker frontend so `/budget` is view-only and `/budget/manage` contains focused add/edit/setup workflows under `frontend/src/pages/modules/budget/`.
- **2026-06-23**: Added Budget Tracker UX polish for overbudget warnings, relative recurring due dates, clearer recurring item form labels/frequency, and inline success feedback.
- **2026-06-23/24**: Added and simplified yearly budget planner at `/budget/yearly`, backed by `/api/budget/yearly-plan/`, reusing existing monthly `Budget` rows as the persisted source of truth while presenting a spreadsheet-style grouped category planner.
