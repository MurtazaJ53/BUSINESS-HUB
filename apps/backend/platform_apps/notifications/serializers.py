from rest_framework import serializers
from platform_apps.notifications.models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "shop",
            "title",
            "message",
            "type",
            "is_read",
            "action_url",
            "metadata_json",
            "created_at",
        ]
        read_only_fields = fields
