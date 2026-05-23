from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from platform_apps.shops.models import ShopMembership
from platform_apps.shops.roles import (
    get_membership_role_label,
    get_membership_role_product_profile,
    get_membership_role_summary,
)
from platform_apps.users.mfa import (
    MFA_CHALLENGE_WINDOW_SECONDS,
    MFA_ISSUER_LABEL,
    build_totp_otpauth_uri,
    format_totp_secret,
    generate_totp_secret,
    verify_totp_code,
)
from platform_apps.users.models import PlatformUser


class SessionUserSerializer(serializers.ModelSerializer):
    mfa_totp_enabled = serializers.SerializerMethodField()

    class Meta:
        model = PlatformUser
        fields = (
            "id",
            "email",
            "full_name",
            "firebase_uid",
            "timezone",
            "is_platform_admin",
            "mfa_totp_enabled",
            "mfa_totp_enabled_at",
            "mfa_totp_last_verified_at",
        )

    def get_mfa_totp_enabled(self, obj):
        return obj.mfa_totp_enabled


class MembershipShopSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.CharField()
    currency_code = serializers.CharField()
    timezone = serializers.CharField()
    is_active = serializers.BooleanField()
    plan_tier = serializers.CharField()
    enabled_features = serializers.DictField(
        child=serializers.BooleanField(),
    )


class SessionMembershipSerializer(serializers.ModelSerializer):
    shop = serializers.SerializerMethodField()
    role_label = serializers.SerializerMethodField()
    role_summary = serializers.SerializerMethodField()
    role_profile = serializers.SerializerMethodField()

    class Meta:
        model = ShopMembership
        fields = (
            "id",
            "role",
            "role_label",
            "role_summary",
            "role_profile",
            "status",
            "permissions_version",
            "permissions_json",
            "shop",
        )

    def get_shop(self, obj):
        return MembershipShopSerializer(obj.shop).data

    def get_role_label(self, obj):
        return get_membership_role_label(obj.role)

    def get_role_summary(self, obj):
        return get_membership_role_summary(obj.role)

    def get_role_profile(self, obj):
        return get_membership_role_product_profile(obj.role)


class UserMfaStatusSerializer(serializers.Serializer):
    totp_enabled = serializers.BooleanField()
    totp_pending_enrollment = serializers.BooleanField()
    enabled_at = serializers.DateTimeField(allow_null=True)
    last_verified_at = serializers.DateTimeField(allow_null=True)
    issuer_label = serializers.CharField()
    account_label = serializers.CharField()
    challenge_window_seconds = serializers.IntegerField()
    pending_manual_secret = serializers.CharField(allow_blank=True)
    pending_otpauth_uri = serializers.CharField(allow_blank=True)


class UserMfaEnrollSerializer(serializers.Serializer):
    def save(self, *, user: PlatformUser) -> dict[str, object]:
        if not user.mfa_totp_enabled and not user.mfa_totp_pending_secret:
            user.mfa_totp_pending_secret = generate_totp_secret()
            user.save(update_fields=["mfa_totp_pending_secret", "updated_at"])

        return build_user_mfa_status_payload(user)


class UserMfaVerifySerializer(serializers.Serializer):
    purpose = serializers.ChoiceField(choices=["enroll", "challenge"])
    code = serializers.CharField(max_length=16)

    def validate(self, attrs):
        user: PlatformUser = self.context["user"]
        purpose = attrs["purpose"]
        secret = (
            user.mfa_totp_pending_secret
            if purpose == "enroll"
            else user.mfa_totp_secret
        )
        if not secret:
            raise serializers.ValidationError(
                {"purpose": "No matching MFA secret is ready for verification."}
            )
        if not verify_totp_code(secret=secret, code=attrs["code"]):
            raise serializers.ValidationError({"code": "Invalid authentication code."})
        return attrs

    def save(self, *, user: PlatformUser) -> dict[str, object]:
        purpose = self.validated_data["purpose"]
        now = timezone.now()
        updated_fields = ["mfa_totp_last_verified_at", "updated_at"]
        user.mfa_totp_last_verified_at = now

        if purpose == "enroll":
            user.mfa_totp_secret = user.mfa_totp_pending_secret
            user.mfa_totp_pending_secret = ""
            user.mfa_totp_enabled_at = now
            updated_fields.extend(
                ["mfa_totp_secret", "mfa_totp_pending_secret", "mfa_totp_enabled_at"]
            )

        user.save(update_fields=updated_fields)
        return {
            "status": build_user_mfa_status_payload(user),
            "verified_at": now,
            "verified_until": now + timedelta(seconds=MFA_CHALLENGE_WINDOW_SECONDS),
        }


class UserMfaDisableSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=16)

    def validate(self, attrs):
        user: PlatformUser = self.context["user"]
        if not user.mfa_totp_enabled or not user.mfa_totp_secret:
            raise serializers.ValidationError(
                {"code": "No active MFA secret is enabled for this account."}
            )
        if not verify_totp_code(secret=user.mfa_totp_secret, code=attrs["code"]):
            raise serializers.ValidationError({"code": "Invalid authentication code."})
        return attrs

    def save(self, *, user: PlatformUser) -> dict[str, object]:
        user.mfa_totp_secret = ""
        user.mfa_totp_pending_secret = ""
        user.mfa_totp_enabled_at = None
        user.mfa_totp_last_verified_at = None
        user.save(
            update_fields=[
                "mfa_totp_secret",
                "mfa_totp_pending_secret",
                "mfa_totp_enabled_at",
                "mfa_totp_last_verified_at",
                "updated_at",
            ]
        )
        return build_user_mfa_status_payload(user)


def build_user_mfa_status_payload(user: PlatformUser) -> dict[str, object]:
    account_label = user.email
    pending_secret = user.mfa_totp_pending_secret.strip()
    return {
        "totp_enabled": user.mfa_totp_enabled,
        "totp_pending_enrollment": bool(pending_secret),
        "enabled_at": user.mfa_totp_enabled_at,
        "last_verified_at": user.mfa_totp_last_verified_at,
        "issuer_label": MFA_ISSUER_LABEL,
        "account_label": account_label,
        "challenge_window_seconds": MFA_CHALLENGE_WINDOW_SECONDS,
        "pending_manual_secret": format_totp_secret(pending_secret) if pending_secret else "",
        "pending_otpauth_uri": (
            build_totp_otpauth_uri(secret=pending_secret, account_label=account_label)
            if pending_secret
            else ""
        ),
    }
