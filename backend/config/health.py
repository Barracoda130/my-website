from django.db import connections
from django.http import JsonResponse


def healthz(request):
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "error", "database": "unreachable"}, status=503)

    return JsonResponse({"status": "ok"}, status=200)
