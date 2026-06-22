from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/budget/', include('budget_tracker.urls')),
    path('api/family/', include('family_finances.urls')),
]
