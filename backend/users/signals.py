from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    profile, _ = UserProfile.objects.get_or_create(user=instance)
    if instance.is_superuser and profile.role != UserProfile.ADMINISTRATOR:
        profile.role = UserProfile.ADMINISTRATOR
        profile.save(update_fields=["role", "updated_at"])
