from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserSectionAccess(models.Model):
	SECTION_EXPENSES = "expenses"
	SECTION_FAMILY_FINANCES = "family-finances"

	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="section_access",
	)
	can_access_expenses = models.BooleanField(default=True)
	can_access_family_finances = models.BooleanField(default=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = "User section access"
		verbose_name_plural = "User section access"

	def __str__(self) -> str:
		return f"Section access for {self.user.username}"

	def allowed_sections(self) -> list[str]:
		sections: list[str] = []
		if self.can_access_expenses:
			sections.append(self.SECTION_EXPENSES)
		if self.can_access_family_finances:
			sections.append(self.SECTION_FAMILY_FINANCES)
		return sections


def get_user_section_access(user) -> UserSectionAccess:
	access, _ = UserSectionAccess.objects.get_or_create(user=user)
	return access


def user_has_section_access(user, section: str) -> bool:
	access = get_user_section_access(user)
	if section == UserSectionAccess.SECTION_EXPENSES:
		return access.can_access_expenses
	if section == UserSectionAccess.SECTION_FAMILY_FINANCES:
		return access.can_access_family_finances
	return False


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_user_section_access(sender, instance, created, **kwargs):
	if created:
		UserSectionAccess.objects.get_or_create(user=instance)
