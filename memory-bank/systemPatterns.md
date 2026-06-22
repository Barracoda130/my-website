# System Patterns

## Architecture Overview
Decoupled full-stack application:
- **Backend**: Django REST Framework API (`localhost:8000`)
- **Frontend**: React SPA via Vite (`localhost:5173`)
- Communication via JSON REST API with JWT authentication

```
frontend/          ← React + Vite + Tailwind CSS
  src/
    api/           ← Axios API layer (client.js, auth.js)
    context/       ← React Context (AuthContext)
    routes/        ← Route guards (ProtectedRoute, ModuleRoute)
    pages/         ← Page components
      modules/     ← Module-specific pages (BudgetTracker, FamilyFinances)

backend/           ← Django project
  config/          ← Django settings, root URLs, WSGI/ASGI
  users/           ← Auth, invite tokens, module access, user groups
  budget_tracker/  ← Budget Tracker module (stub)
  family_finances/ ← Family Finances module (stub)
```

## Key Technical Decisions

### JWT Authentication
- `djangorestframework-simplejwt` handles token issuance, refresh, and blacklisting
- Access token: 60 minutes; Refresh token: 7 days with rotation
- `BLACKLIST_AFTER_ROTATION = True` — old refresh tokens are invalidated on each refresh
- Tokens stored in `localStorage` (not httpOnly cookies) — acceptable for personal/trusted-user app

### Invite-Only Registration
- `InviteToken` model: UUID token, single-use, optional expiry
- Admin creates tokens via Django admin; shares link manually
- Token validated before showing registration form (UX: fail fast)
- Token marked `is_used=True` and linked to the new user on successful registration

### Module Access System
- `UserModuleAccess` model: links a `User` to a module slug string
- Module slugs are defined in `AVAILABLE_MODULES` list in `users/models.py`
- Adding a new module requires: adding slug to `AVAILABLE_MODULES`, creating Django app, adding frontend route + page
- `unique_together = ('user', 'module')` prevents duplicate grants

### User Groups
- `UserGroup` model: named groups with many-to-many `members`
- Intended for collaborative modules (e.g. Family Finances — shared data between household members)
- Groups are fetched via `/api/auth/me/groups/` but not yet used in module logic

## Frontend Patterns

### AuthContext
Central auth state provider wrapping the entire app. Exposes:
- `user` — current user object (or `null`)
- `modules` — list of `UserModuleAccess` objects
- `loading` — true while checking stored token on app load
- `login(username, password)` — calls API, stores tokens, fetches user+modules
- `logout()` — blacklists token, clears state
- `hasModuleAccess(slug)` — checks if slug is in `modules` list
- `isAuthenticated` — boolean derived from `user`

### Route Guards
Two components in `routes/ProtectedRoute.jsx`:
- `ProtectedRoute` — redirects to `/login` if not authenticated; shows loading spinner while checking
- `ModuleRoute` — redirects to `/unauthorized` if user lacks module access; must be nested inside `ProtectedRoute`

### API Layer
- `api/client.js` — Axios instance with base URL + request/response interceptors
  - Request interceptor: attaches `Authorization: Bearer <token>` header
  - Response interceptor: on 401, attempts token refresh then retries; on failure, redirects to `/login`
- `api/auth.js` — named functions for each auth endpoint (login, register, logout, getMe, getMyModules, getMyGroups, validateInvite)

### Dashboard Module Cards
- `MODULE_INFO` map in `Dashboard.jsx` defines display metadata (title, description, icon, route, colours) for each module slug
- When adding a new module, add an entry to `MODULE_INFO` and register the route in `App.jsx`

## Backend Patterns

### URL Structure
```
/admin/                        ← Django admin
/api/auth/login/               ← JWT token obtain (POST)
/api/auth/token/refresh/       ← JWT token refresh (POST)
/api/auth/invite/validate/     ← Validate invite token (POST)
/api/auth/register/            ← Register new user (POST)
/api/auth/logout/              ← Blacklist refresh token (POST)
/api/auth/me/                  ← Current user data (GET)
/api/auth/me/modules/          ← User's module access list (GET)
/api/auth/me/groups/           ← User's groups (GET)
/api/budget/                   ← Budget Tracker API (stub)
/api/family/                   ← Family Finances API (stub)
```

### Adding a New Module — Checklist
1. Add slug + display name to `AVAILABLE_MODULES` in `backend/users/models.py`
2. Create Django app: `python manage.py startapp <slug>`
3. Add app to `INSTALLED_APPS` in `config/settings.py`
4. Create models, views, URLs in the new app
5. Wire up `path('api/<slug>/', include('<slug>.urls'))` in `config/urls.py`
6. Create `frontend/src/pages/modules/<ModuleName>.jsx`
7. Add entry to `MODULE_INFO` in `frontend/src/pages/Dashboard.jsx`
8. Add `<Route>` with `<ProtectedRoute>` + `<ModuleRoute moduleSlug="<slug>">` in `frontend/src/App.jsx`
