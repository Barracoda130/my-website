# Railway Deployment

This project is designed to deploy as separate Railway services for the existing split architecture:

1. Railway PostgreSQL database
2. Django/DRF backend service from `backend/`
3. React/Vite frontend service from `frontend/`

## Backend service

Set the Railway service root directory to `backend/`.

Required variables:

```env
SECRET_KEY=<generate a long random Django secret>
DEBUG=False
ALLOWED_HOSTS=<your-backend>.up.railway.app
CORS_ALLOWED_ORIGINS=https://<your-frontend>.up.railway.app
CSRF_TRUSTED_ORIGINS=https://<your-frontend>.up.railway.app,https://<your-backend>.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

The backend start command runs migrations, collects static files for Django admin assets, and starts Gunicorn:

```bash
python manage.py migrate && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

## Frontend service

Set the Railway service root directory to `frontend/`.

Required variables:

```env
VITE_API_BASE_URL=https://<your-backend>.up.railway.app/api
```

The frontend start command serves the built Vite app on Railway's assigned port:

```bash
npm run preview -- --host 0.0.0.0 --port $PORT
```

## Security and rate limiting

- Django reads production configuration from environment variables.
- Railway Postgres is used automatically when `DATABASE_URL` is set.
- `DEBUG=False` enables HTTPS redirects, secure cookies, HSTS, `X_FRAME_OPTIONS=DENY`, and content type nosniffing.
- Login, token refresh, invite validation, and registration endpoints use DRF scoped throttling.
- Default throttle rates can be overridden with:
  - `DRF_LOGIN_THROTTLE_RATE`
  - `DRF_TOKEN_REFRESH_THROTTLE_RATE`
  - `DRF_REGISTER_THROTTLE_RATE`
  - `DRF_INVITE_VALIDATE_THROTTLE_RATE`
  - `DRF_ANON_THROTTLE_RATE`
  - `DRF_USER_THROTTLE_RATE`

## Post-deploy setup

Create the first admin user from the backend service shell:

```bash
python manage.py createsuperuser
```

Then use Django admin to create invite tokens and grant module access.