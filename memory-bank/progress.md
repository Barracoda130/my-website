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

## What's Left to Build

### Budget Tracker Module
- [ ] Django models (transactions, categories, budgets)
- [ ] DRF serializers + views (CRUD)
- [ ] URL patterns in `budget_tracker/urls.py`
- [ ] Frontend `BudgetTracker.jsx` page (currently a stub)
- [ ] API functions in `frontend/src/api/` for budget endpoints

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
**Phase**: Core scaffolding complete. Ready to implement feature modules.

## Known Issues / Notes
- `SECRET_KEY` in `settings.py` is a placeholder — must be changed before any production deployment
- API base URL is hardcoded in two places (`client.js` and `auth.js`) — consider extracting to a shared constant or environment variable
- No tests written yet (test files exist but are empty stubs)
- `db.sqlite3` is present in the repo root of `backend/` — ensure it stays gitignored

## Evolution of Decisions
- **2026-06-22**: Project scaffolded with full auth system and module access control. Memory Bank initialised.
