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
| SQLite | built-in | Database (development) |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | ^19.2.6 | UI framework |
| React DOM | ^19.2.6 | DOM rendering |
| React Router DOM | ^7.18.0 | Client-side routing |
| Axios | ^1.18.0 | HTTP client |
| Vite | ^8.0.12 | Build tool / dev server |
| Tailwind CSS | ^4.3.1 | Utility-first CSS (via `@tailwindcss/vite` plugin) |
| @vitejs/plugin-react | ^6.0.1 | React fast refresh in Vite |

## Development Setup

### Running the Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # to create admin account
python manage.py runserver         # runs on http://localhost:8000
```

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
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── users/                 ← Auth + user management app
│   │   ├── models.py          ← UserProfile, InviteToken, UserModuleAccess, UserGroup
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── budget_tracker/        ← Budget Tracker app (stub)
│   └── family_finances/       ← Family Finances app (stub)
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx            ← Root component + route definitions
        ├── main.jsx           ← React entry point
        ├── api/
        │   ├── client.js      ← Axios instance + interceptors
        │   └── auth.js        ← Auth API functions
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
                ├── BudgetTracker.jsx   ← stub
                └── FamilyFinances.jsx  ← stub
```

## Configuration Notes
- **API base URL**: hardcoded as `http://localhost:8000/api` in `frontend/src/api/client.js` and `auth.js`
- **CORS**: frontend origin `http://localhost:5173` is whitelisted in Django settings
- **JWT tokens**: stored in `localStorage` under keys `access_token` and `refresh_token`
- **Time zone**: `Europe/London` (set in Django settings)
- **Secret key**: currently uses insecure placeholder — must be replaced with env variable for production

## Git
- Remote: `https://github.com/Barracoda130/my-website.git`
- `db.sqlite3` is gitignored (backend `.gitignore`)
