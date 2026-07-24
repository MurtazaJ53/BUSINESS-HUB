"""Self-serve shop registration.

`POST /api/v1/register/` — unauthenticated. Creates an owner account, provisions
an isolated shop workspace, and returns a JWT pair so the owner is signed in
immediately (no separate login round-trip).
"""
from __future__ import annotations

import re

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.shops.provisioning import provision_shop
from platform_apps.users.jwt_auth import issue_tokens

User = get_user_model()

# Basic GSTIN shape check (15 chars: 2 state + 10 PAN + 3). Kept lenient - a
# wrong-but-well-formed GSTIN is the owner's responsibility to correct later.
_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$")


class RegistrationSerializer(serializers.Serializer):
    owner_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(
        min_length=8, write_only=True, style={"input_type": "password"}
    )
    mobile = serializers.CharField(max_length=32, required=False, allow_blank=True)
    business_name = serializers.CharField(max_length=255)
    business_type = serializers.CharField(
        max_length=32, required=False, allow_blank=True
    )
    state_code = serializers.CharField(max_length=2, required=False, allow_blank=True)
    gstin = serializers.CharField(max_length=15, required=False, allow_blank=True)
    plan_tier = serializers.CharField(max_length=16, required=False, allow_blank=True)

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists. Please sign in instead."
            )
        return value

    def validate_owner_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Please enter your full name.")
        return cleaned

    def validate_business_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Please enter your business name.")
        return cleaned

    def validate_gstin(self, value: str) -> str:
        cleaned = (value or "").strip().upper()
        if cleaned and not _GSTIN_RE.match(cleaned):
            raise serializers.ValidationError(
                "That GSTIN doesn't look valid. Leave it blank if you're unsure."
            )
        return cleaned


class RegisterView(APIView):
    """Create an owner + shop and return JWT tokens."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            user = User(
                email=data["email"],
                full_name=data["owner_name"],
                is_active=True,
                source_system="registration",
            )
            user.set_password(data["password"])
            user.save()

            shop, membership = provision_shop(
                owner=user,
                business_name=data["business_name"],
                business_type=data.get("business_type") or "retail",
                state_code=data.get("state_code") or "",
                gstin=data.get("gstin") or "",
                plan_tier=data.get("plan_tier") or "starter",
                owner_phone=data.get("mobile") or "",
                source_surface="registration",
            )

        tokens = issue_tokens(user)
        return Response(
            {
                **tokens,
                "shop_id": str(shop.id),
                "shop_name": shop.name,
                "shop_slug": shop.slug,
                "role": membership.role,
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )
