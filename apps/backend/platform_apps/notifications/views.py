from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from platform_apps.notifications.models import Notification
from platform_apps.notifications.serializers import NotificationSerializer

class NotificationListView(generics.ListAPIView):
    """List all notifications for the authenticated user."""
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        shop_id = self.request.query_params.get("shop_id")
        if shop_id:
            qs = qs.filter(shop_id=shop_id)
        return qs

class NotificationReadView(APIView):
    """Mark a specific notification as read."""

    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
        return Response({"status": "read"})

class NotificationReadAllView(APIView):
    """Mark all unread notifications as read for the authenticated user."""

    def post(self, request):
        qs = Notification.objects.filter(recipient=request.user, is_read=False)
        shop_id = request.data.get("shop_id")
        if shop_id:
            qs = qs.filter(shop_id=shop_id)
        
        updated = qs.update(is_read=True)
        return Response({"status": "success", "updated_count": updated})
