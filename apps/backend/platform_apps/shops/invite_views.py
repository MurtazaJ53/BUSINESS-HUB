"""Invitation API — shop-scoped (create/list/revoke) and public (preview/accept)."""
from __future__ import annotations

from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.shops.invites import (
    accept_invite,
    create_invite,
    get_live_invite,
    revoke_invite,
)
from platform_apps.shops.models import ShopInvite, ShopMembership
from platform_apps.shops.permissions import get_membership_or_403
from platform_apps.users.jwt_auth import issue_tokens


def _serialize_invite(invite: ShopInvite) -> dict:
    email_result = getattr(invite, "_email_result", None)
    data = {
        "id": str(invite.id),
        "email": invite.email,
        "role": invite.role,
        "role_label": dict(ShopMembership.Role.choices).get(invite.role, invite.role),
        "status": invite.status,
        "expires_at": invite.expires_at.isoformat(),
        "created_at": invite.created_at.isoformat(),
        # The token is only echoed to the inviter, for a shareable link / QR.
        "invite_code": invite.token,
    }
    if email_result is not None:
        # Honest email delivery status, so the UI never falsely says "sent".
        data["email_sent"] = bool(email_result.get("ok"))
        data["email_status"] = email_result.get("status", "")
        data["email_error"] = email_result.get("error", "")
    return data


class InviteCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.CharField(max_length=16)
    message = serializers.CharField(
        max_length=280, required=False, allow_blank=True
    )


class ShopInviteListCreateView(APIView):
    """GET pending invites / POST a new invite. Manager+ only."""

    def get(self, request, shop_id):
        get_membership_or_403(request.user, shop_id, ShopMembership.Role.MANAGER)
        invites = ShopInvite.objects.filter(
            shop_id=shop_id, status=ShopInvite.Status.PENDING
        )
        return Response([_serialize_invite(i) for i in invites])

    def post(self, request, shop_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.MANAGER
        )
        serializer = InviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        invite = create_invite(
            shop=membership.shop,
            invited_by=request.user,
            actor_role=membership.role,
            email=data["email"],
            role=data["role"],
            message=data.get("message", ""),
        )
        return Response(
            _serialize_invite(invite), status=status.HTTP_201_CREATED
        )


class ShopInviteRevokeView(APIView):
    def post(self, request, shop_id, invite_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.MANAGER
        )
        invite = revoke_invite(
            shop=membership.shop,
            invite_id=invite_id,
            actor_user=request.user,
            actor_role=membership.role,
        )
        return Response(_serialize_invite(invite))


class InvitePreviewView(APIView):
    """Public: preview an invite (shop + role) before accepting."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        invite = get_live_invite(token)
        return Response(
            {
                "shop_name": invite.shop.name,
                "role": invite.role,
                "role_label": dict(ShopMembership.Role.choices).get(
                    invite.role, invite.role
                ),
                "email": invite.email,
            }
        )


class InviteAcceptSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    password = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )


class InviteAcceptView(APIView):
    """Public: accept an invite. Creates/links the user, activates membership,
    and returns a JWT pair so the invitee is signed straight into the shop."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InviteAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user, shop, membership = accept_invite(
            token=data["token"],
            name=data.get("name", ""),
            password=data["password"],
        )
        tokens = issue_tokens(user)
        return Response(
            {
                **tokens,
                "shop_id": str(shop.id),
                "shop_name": shop.name,
                "role": membership.role,
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )
