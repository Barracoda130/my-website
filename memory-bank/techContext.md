# Tech Context

## Technology Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.x | Runtime |
| Django | >=5.1 | Web framework |
| Django REST Framework | >=3.15 | REST API |
| djangorestframework-simplejwt | >=5.5 | JWT auth + token blacklisting |
| django-cors-headers | >=4.6 | CORS for frontend dev server |
| dj-database-url | >=2.3 | Parse Railway/Postgres `DATABASE_URL` |
| psycopg[binary] | >=3.2 | PostgreSQL database driver |
| gunicorn | >=23.0 | Production WSGI server on Railway |
| whitenoise | >=6.8 | Static/admin asset serving for Django |
| pytest | >=8.0 | Backend test runner |
| pytest-django | >=4.8 | Django integration for pytest |
| SQLite | built-in | Database fallback for local development |
| PostgreSQL | Railway managed | Production database |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | ^19.2.6 | UI framework |
| React DOM | ^19.2.6 | DOM rendering |
| React Router DOM | ^7.18.0 | Client-side routing |
| Axios | ^1.18.0 | HTTP client |
| serve | ^14.2.5 | Production static server for Railway frontend service |
| Vite | ^8.0.12 | Build tool / dev server |
| Tailwind CSS | ^4.3.1 | Utility-first CSS (via `@tailwindcss/vite` plugin) |
| @vitejs/plugin-react | ^6.0.1 | React fast refresh in Vite |

Vite 8 requires Node `20.19+` or `22.12+`; Railway frontend builds are pinned to Node `22.12.0` using `frontend/nixpacks.toml` and `frontend/package.json` engines. Railway serves the built frontend with `serve dist --single` rather than `vite preview`, giving production-oriented static serving plus SPA route fallback.

## Development Setup

### Running the Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # to create admin account
python manage.py runserver         # runs on http://localhost:8000
```

### Running Backend Tests
```bash
cd backend
pytest
```

`backend/pytest.ini` sets `DJANGO_SETTINGS_MODULE = config.test_settings`, so pytest automatically uses `backend/config/test_settings.py`. That settings module uses an in-memory SQLite dummy database (`NAME=':memory:'`), meaning backend tests do not touch the application development database at `backend/db.sqlite3`.

### Running the Frontend
```bash
cd frontend
npm install
npm run dev    # runs on http://localhost:5173
```

### Creating an Invite Token
1. Go to `http://localhost:8000/admin/`
2. Log in with superuser credentials
3. Navigate to **Users → Invite Tokens → Add**
4. Save — copy the UUID token
5. Share link: `http://localhost:5173/register?invite=<token>`

### Granting Module Access
1. Go to `http://localhost:8000/admin/`
2. Navigate to **Users → User Module Access → Add**
3. Select user, select module slug, save

## Project Structure
```
my-website/
├── .clinerules/
│   └── MemoryBank.md          ← Memory Bank instructions
├── memory-bank/               ← Memory Bank files (this directory)
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── db.sqlite3             ← SQLite database (dev only, gitignored)
│   ├── config/                ← Django project config
│   │   ├── settings.py
│   │   ├── test_settings.py      ← pytest settings with in-memory SQLite test DB
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── users/                 ← Auth + user management app
│   │   ├── models.py          ← UserProfile, InviteToken, UserModuleAccess, UserGroup
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── budget_tracker/        ← Budget Tracker app (MVP implemented)
│   └── family_finances/       ← Family Planner / Family Fairness Ledger app
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx            ← Root component + route definitions
        ├── main.jsx           ← React entry point
        ├── api/
        │   ├── client.js      ← Axios instance + interceptors
        │   ├── auth.js        ← Auth API functions
        │   └── budget.js      ← Budget Tracker API functions
        ├── context/
        │   └── AuthContext.jsx ← Global auth state
        ├── routes/
        │   └── ProtectedRoute.jsx ← ProtectedRoute + ModuleRoute guards
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Dashboard.jsx
            ├── Unauthorized.jsx
            ├── NotFound.jsx
            └── modules/
                ├── budget/
                │   ├── BudgetDashboard.jsx ← view-only Budget Tracker dashboard
                │   ├── BudgetManage.jsx    ← focused add/edit/setup workflows
                │   ├── useBudgetData.js    ← shared Budget Tracker data loading hook
                │   └── helpers.js          ← shared Budget Tracker formatting/defaults
                ├── FamilyFinances.jsx  ← legacy stub no longer routed
                └── family/             ← Family Planner pages/components
```

## Configuration Notes
- **API base URL**: `frontend/src/api/client.js` exports `API_BASE_URL` from `VITE_API_BASE_URL`, falling back to `http://localhost:8000/api` for local development
- **CORS**: local Vite origins are whitelisted only when `DEBUG=True`; production origins come from `CORS_ALLOWED_ORIGINS`
- **JWT tokens**: stored in `localStorage` under keys `access_token` and `refresh_token`
- **Time zone**: `Europe/London` (set in Django settings)
- **Secret key**: read from `SECRET_KEY` env var; local fallback remains only for development
- **Railway deployment**: see `RAILWAY_DEPLOYMENT.md`; backend uses `DATABASE_URL` for Railway Postgres and frontend uses `VITE_API_BASE_URL`

## Family Planner Setup Notes
- Create families in Django admin under **Family Finances → Families**, then share the family `code` with invited users.
- During registration, users can optionally enter the family code to join that family and automatically receive `family_finances` access.
- Development seed command:
```bash
cd backend
python manage.py seed_family_planner
```
- The seed command creates `Demo Family` with code `DEMO-FAMILY`, 4 children, example split transactions, excluded support, large expense, and recurring allowance templates.

## Git
- Remote: `https://github.com/Barracoda130/my-website.git`
- `db.sqlite3` is gitignored (backend `.gitignore`)
