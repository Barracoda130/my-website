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
- `GET, POST /api/expenses/entries/`
- `GET, PATCH, DELETE /api/expenses/entries/{id}/`
- `GET /api/expenses/summary/`

Supported query params for list/summary:
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `category=<id>`

Starter categories are created automatically per user the first time categories are fetched:
- Food
- Transport
- Housing
- Utilities
- Entertainment
- Health

Users can still create any additional custom categories from the UI.

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
