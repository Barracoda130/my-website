from .settings import *  # noqa: F403


# Pytest/Django tests should never use the application's development database.
# pytest.ini points at this settings module automatically, so `pytest` uses a
# disposable in-memory SQLite database without needing `--settings`.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
