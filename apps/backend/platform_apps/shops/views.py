from __future__ import annotations

from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from platform_apps.shops.models import ShopMembership
from platform_apps.shops.serializers import ShopMembershipListSerializer


class ShopMembershipListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ShopMembershipListSerializer

    def get_queryset(self):
        return (
            ShopMembership.objects.select_related("shop")
            .filter(user=self.request.user)
            .order_by("shop__name")
        )
