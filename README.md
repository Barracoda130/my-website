# My Website Monorepo

Initial implementation for a split-stack platform:
- Frontend: React + Vite + TypeScript
- Backend: Django + Django REST Framework
- Contract: Backend-generated OpenAPI schema + generated frontend types
- Auth: Session cookie auth with CSRF protection
- Feature module: Expense tracker (categories, entries, filters, summary)

## Repository Layout

- `frontend/` React client
- `backend/` Django API
- `scripts/` Contract generation scripts

## Backend Setup

1. Create and activate a virtual environment.
2. Install dependencies:
   - `pip install -r backend/requirements.txt`
3. Apply migrations:
   - `python backend/manage.py migrate`
4. Run backend server:
   - `python backend/manage.py runserver`

## Frontend Setup

1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Start dev server:
   - `npm run dev`

Set `VITE_API_BASE_URL` (for example in `.env.local`) if backend URL differs from `http://localhost:8000`.

## Auth Endpoints

- `GET /api/auth/csrf/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`

## Expense Endpoints

- `GET, POST /api/expenses/categories/`
- `GET, PATCH, DELETE /api/expenses/categories/{id}/`
- `GET, POST /api/expenses/budgets/`
- `GET, PATCH, DELETE /api/expenses/budgets/{id}/`
- `GET, POST /api/expenses/entries/`
- `GET, PATCH, DELETE /api/expenses/entries/{id}/`
- `GET /api/expenses/summary/`

Supported query params for list/summary:
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `category=<id>`
- `entry_type=expense|income`
- `search=<text>` (matches transaction title and notes)

Starter categories are created automatically per user the first time categories are fetched:
- Food
- Transport
- Housing
- Utilities
- Entertainment
- Health

Users can still create any additional custom categories from the UI.

Budget setup is available in the frontend under the `Budget Setup` tab.

Seed a second demo account with sample transactions:
- `python backend/manage.py seed_demo_account`

Default seeded login:
- Username: `testuser2`
- Password: `StrongPassword123!`

## Contract Generation

From repo root:
- `./scripts/generate_openapi.ps1`
- `./scripts/generate_typed_client.ps1`

Outputs:
- `backend/openapi.yaml`
- `frontend/src/api/generated/schema.ts`

## Tests

Backend:
- `python backend/manage.py test`

Frontend:
- `cd frontend`
- `npm run test:run`

Build check:
- `cd frontend`
- `npm run build`

## Production Deployment (Initial)

### Backend

1. Install backend dependencies:
   - `pip install -r backend/requirements.txt`
2. Set environment variables (copy from `backend/.env.example` and update values).
3. Run database migrations:
   - `python backend/manage.py migrate`
4. Collect static files:
   - `python backend/manage.py collectstatic --noinput`
5. Start the app server:
   - `gunicorn config.wsgi:application --chdir backend --bind 0.0.0.0:$PORT`

Admin account bootstrap:
- The backend startup path runs `python manage.py ensure_admin_account`.
- Set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in backend env variables.
- The command is idempotent: it creates the admin user if missing, or updates email/password and admin flags if the user already exists.

### Frontend

1. Configure API base URL for production:
   - `VITE_API_BASE_URL=https://<your-backend-domain>`
2. Build frontend assets:
   - `cd frontend`
   - `npm ci`
   - `npm run build`
3. Deploy `frontend/dist` to your static host.

### Required Production Environment Variables

- `DJANGO_SECRET_KEY` (strong unique secret)
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS=<backend-domain>`
- `DATABASE_URL=<managed-postgres-url>`
- `CORS_ALLOWED_ORIGINS=<frontend-origin>`
- `CSRF_TRUSTED_ORIGINS=<frontend-origin>`
- `SESSION_COOKIE_SECURE=True`
- `CSRF_COOKIE_SECURE=True`
- `SESSION_COOKIE_SAMESITE` and `CSRF_COOKIE_SAMESITE`
  - same-origin deploy: `Lax`
  - cross-origin deploy: `None` (requires HTTPS)

### Deployment Smoke Tests

After deploy, verify:
- `GET /healthz/` returns 200 and reports `{"status": "ok"}`.
- `GET /api/auth/csrf/` returns 200 and sets CSRF cookie.
- Login, `GET /api/auth/me/`, and logout all work end-to-end.
- Expense list/create/update/delete works for authenticated user.
- Cross-user access is blocked for category, budget, and entry detail routes.

### Railway Setup (Monorepo)

Create two Railway services from this repository:

1. Backend service:
    - Root directory: `backend`
    - Config file: `backend/railway.toml`
   - Builder: Dockerfile (`backend/Dockerfile`)
    - Required env vars: all backend production variables listed above
2. Frontend service:
    - Root directory: `frontend`
    - Config file: `frontend/railway.toml`
    - Required env var: `VITE_API_BASE_URL=https://<backend-domain>`

Recommended order:
1. Deploy backend service first and verify `GET /healthz/`.
2. Set frontend `VITE_API_BASE_URL` to backend URL.
3. Deploy frontend service.

## CI Deploy Gates

GitHub Actions workflow at `.github/workflows/ci.yml` enforces:

- Production settings validation: `python manage.py check --deploy --fail-level WARNING`
- Migration safety checks:
   - `python manage.py makemigrations --check --dry-run`
   - `python manage.py migrate --noinput`
- Backend tests: `python manage.py test accounts expenses`
- Frontend quality gates:
   - `npm run lint`
   - `npm run test:run`
   - `npm run build`
