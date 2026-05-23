from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

from platform_apps.shops.models import ShopMembership, ShopPlanRequest
from platform_apps.shops.permissions import (
    can_manage_workspace_membership,
    ensure_workspace_membership_management_or_403,
    ensure_workspace_ownership_transfer_or_403,
    ensure_workspace_role_assignment_or_403,
)
from platform_apps.shops.plans import PLAN_TIERS, normalize_plan_tier
from platform_apps.shops.roles import (
    get_membership_role_label,
    get_membership_role_product_profile,
    get_membership_role_summary,
    normalize_membership_role,
)
from platform_apps.users.models import PlatformUser


class ShopMembershipListSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id")
    shop_name = serializers.CharField(source="shop.name")
    shop_slug = serializers.CharField(source="shop.slug")
    shop_currency_code = serializers.CharField(source="shop.currency_code")
    shop_timezone = serializers.CharField(source="shop.timezone")
    shop_plan_tier = serializers.CharField(source="shop.plan_tier")
    shop_enabled_features = serializers.DictField(
        source="shop.enabled_features",
        child=serializers.BooleanField(),
    )
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
            "shop_id",
            "shop_name",
            "shop_slug",
            "shop_currency_code",
            "shop_timezone",
            "shop_plan_tier",
            "shop_enabled_features",
        )

    def get_role_label(self, obj):
        return get_membership_role_label(obj.role)

    def get_role_summary(self, obj):
        return get_membership_role_summary(obj.role)

    def get_role_profile(self, obj):
        return get_membership_role_product_profile(obj.role)


class ShopDomainStateSerializer(serializers.Serializer):
    shop_id = serializers.UUIDField()
    domain = serializers.CharField()
    control_present = serializers.BooleanField()
    write_master = serializers.CharField()
    bridge_mode = serializers.CharField()
    cutover_status = serializers.CharField()
    current_epoch = serializers.IntegerField()
    shadow_reads_enabled = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    can_write_on_postgres_surface = serializers.BooleanField()
    pilot_signoff_status = serializers.CharField(allow_null=True)
    pilot_signoff_summary = serializers.CharField(allow_blank=True, allow_null=True)
    pilot_recommended_action = serializers.CharField(allow_blank=True, allow_null=True)
    pilot_latest_verify_result = serializers.CharField(allow_blank=True, allow_null=True)


class ShopPlanRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source="requested_by_user.full_name", read_only=True)

    class Meta:
        model = ShopPlanRequest
        fields = (
            "id",
            "current_plan_tier",
            "requested_plan_tier",
            "status",
            "request_note",
            "context_json",
            "requested_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "current_plan_tier",
            "status",
            "context_json",
            "requested_by_name",
            "created_at",
            "updated_at",
        )


class ShopPlanRequestCreateSerializer(serializers.Serializer):
    requested_plan_tier = serializers.CharField(max_length=16)
    request_note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    context_json = serializers.DictField(required=False)

    def validate_requested_plan_tier(self, value: str) -> str:
        normalized = normalize_plan_tier(value)
        membership = self.context["membership"]
        current_tier = membership.shop.plan_tier
        tier_order = {tier: index for index, tier in enumerate(PLAN_TIERS)}

        if normalized == current_tier:
            raise serializers.ValidationError("This workspace is already on that plan.")

        if tier_order[normalized] < tier_order[current_tier]:
            raise serializers.ValidationError("Plan requests must move upward, not downward.")

        if current_tier == PLAN_TIERS[-1]:
            raise serializers.ValidationError("This workspace is already on the highest curated plan.")

        return normalized


class WorkspaceTeamMemberSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_email = serializers.SerializerMethodField()
    role_label = serializers.SerializerMethodField()
    role_summary = serializers.SerializerMethodField()
    role_profile = serializers.SerializerMethodField()
    is_current_user = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = ShopMembership
        fields = (
            "id",
            "member_name",
            "member_email",
            "phone",
            "role",
            "role_label",
            "role_summary",
            "role_profile",
            "status",
            "permissions_version",
            "permissions_json",
            "is_current_user",
            "can_manage",
            "created_at",
            "updated_at",
        )

    def get_member_name(self, obj):
        return obj.user.full_name or obj.email or obj.user.email

    def get_member_email(self, obj):
        return obj.user.email or obj.email

    def get_role_label(self, obj):
        return get_membership_role_label(obj.role)

    def get_role_summary(self, obj):
        return get_membership_role_summary(obj.role)

    def get_role_profile(self, obj):
        return get_membership_role_product_profile(obj.role)

    def get_is_current_user(self, obj):
        actor_membership = self.context.get("actor_membership")
        return bool(actor_membership and actor_membership.user_id == obj.user_id)

    def get_can_manage(self, obj):
        actor_membership = self.context.get("actor_membership")
        if actor_membership is None:
            return False
        if actor_membership.user_id == obj.user_id:
            return False
        return can_manage_workspace_membership(actor_membership.role, obj.role)


class WorkspaceTeamMemberCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    role = serializers.CharField(max_length=16)

    def validate_role(self, value: str) -> str:
        normalized = normalize_membership_role(value)
        if normalized == ShopMembership.Role.OWNER:
            raise serializers.ValidationError("Create owners through a dedicated ownership transfer flow.")

        actor_membership = self.context["actor_membership"]
        ensure_workspace_role_assignment_or_403(actor_membership, normalized)
        return normalized

    def create_or_update_membership(self) -> tuple[ShopMembership, bool]:
        actor_membership = self.context["actor_membership"]
        validated = self.validated_data
        email = validated["email"].strip().lower()
        full_name = validated.get("full_name", "").strip()
        phone = validated.get("phone", "").strip()
        target_role = validated["role"]

        user, user_created = PlatformUser.objects.get_or_create(
            email=email,
            defaults={
                "full_name": full_name,
                "source_system": "business-hub-team",
                "source_id": email,
                "source_path": f"shops/{actor_membership.shop_id}/team/{email}",
            },
        )
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            user.save(update_fields=["full_name", "updated_at"])

        membership, membership_created = ShopMembership.objects.get_or_create(
            user=user,
            shop=actor_membership.shop,
            defaults={
                "role": target_role,
                "status": (
                    ShopMembership.Status.INVITED
                    if user_created
                    else ShopMembership.Status.ACTIVE
                ),
                "email": email,
                "phone": phone,
                "permissions_json": {},
                "source_system": "business-hub-team",
                "source_id": email,
                "source_shop_id": actor_membership.shop.source_id,
                "source_path": f"shops/{actor_membership.shop_id}/team/{email}",
            },
        )

        if membership_created:
            return membership, True

        ensure_workspace_membership_management_or_403(actor_membership, membership)
        updated_fields: list[str] = []
        if membership.role != target_role:
            membership.role = target_role
            updated_fields.append("role")
        if membership.status != ShopMembership.Status.ACTIVE:
            membership.status = ShopMembership.Status.ACTIVE
            updated_fields.append("status")
        if membership.email != email:
            membership.email = email
            updated_fields.append("email")
        if phone and membership.phone != phone:
            membership.phone = phone
            updated_fields.append("phone")

        if updated_fields:
            updated_fields.append("updated_at")
            membership.save(update_fields=updated_fields)

        return membership, False


class WorkspaceTeamMemberUpdateSerializer(serializers.Serializer):
    role = serializers.CharField(required=False, max_length=16)
    status = serializers.ChoiceField(
        required=False,
        choices=[
            ShopMembership.Status.ACTIVE,
            ShopMembership.Status.INVITED,
            ShopMembership.Status.DISABLED,
        ],
    )

    def validate(self, attrs):
        actor_membership = self.context["actor_membership"]
        target_membership = self.context["target_membership"]
        ensure_workspace_membership_management_or_403(actor_membership, target_membership)

        if "role" in attrs:
            normalized_role = normalize_membership_role(attrs["role"])
            if normalized_role == ShopMembership.Role.OWNER:
                raise serializers.ValidationError(
                    {"role": "Use a dedicated ownership transfer flow for owner changes."}
                )
            ensure_workspace_role_assignment_or_403(actor_membership, normalized_role)
            attrs["role"] = normalized_role

        if "status" in attrs:
            next_status = attrs["status"]
            if next_status == ShopMembership.Status.DISABLED and target_membership.role == ShopMembership.Role.OWNER:
                raise serializers.ValidationError(
                    {"status": "Workspace owners cannot be disabled from this surface."}
                )

        if not attrs:
            raise serializers.ValidationError("No membership changes were provided.")

        return attrs

    def apply(self) -> ShopMembership:
        target_membership = self.context["target_membership"]
        validated = self.validated_data
        updated_fields: list[str] = []

        if "role" in validated and target_membership.role != validated["role"]:
            target_membership.role = validated["role"]
            updated_fields.append("role")

        if "status" in validated and target_membership.status != validated["status"]:
            target_membership.status = validated["status"]
            updated_fields.append("status")

        if updated_fields:
            updated_fields.append("updated_at")
            target_membership.save(update_fields=updated_fields)

        return target_membership


class WorkspaceOwnershipTransferResultSerializer(serializers.Serializer):
    shop_id = serializers.UUIDField()
    shop_name = serializers.CharField()
    previous_owner_membership_id = serializers.UUIDField()
    previous_owner_email = serializers.EmailField()
    previous_owner_name = serializers.CharField()
    previous_owner_role = serializers.CharField()
    previous_owner_role_label = serializers.CharField()
    new_owner_membership_id = serializers.UUIDField()
    new_owner_email = serializers.EmailField()
    new_owner_name = serializers.CharField()
    transferred_at = serializers.DateTimeField()


class WorkspaceOwnershipTransferSerializer(serializers.Serializer):
    target_membership_id = serializers.UUIDField()
    previous_owner_role = serializers.CharField(
        required=False,
        default=ShopMembership.Role.ADMIN,
        max_length=16,
    )
    confirmation_text = serializers.CharField(max_length=255)

    def validate_previous_owner_role(self, value: str) -> str:
        normalized = normalize_membership_role(value)
        if normalized == ShopMembership.Role.OWNER:
            raise serializers.ValidationError("The previous owner must move to a lower workspace role.")
        return normalized

    def validate_confirmation_text(self, value: str) -> str:
        confirmation = value.strip()
        actor_membership = self.context["actor_membership"]
        if confirmation.lower() != actor_membership.shop.slug.lower():
            raise serializers.ValidationError("Type the exact workspace slug to confirm ownership transfer.")
        return confirmation

    def validate(self, attrs):
        actor_membership = self.context["actor_membership"]
        ensure_workspace_role_assignment_or_403(actor_membership, attrs["previous_owner_role"])

        target_membership = (
            ShopMembership.objects.filter(
                shop=actor_membership.shop,
                pk=attrs["target_membership_id"],
            )
            .select_related("user", "shop")
            .first()
        )
        if target_membership is None:
            raise serializers.ValidationError(
                {"target_membership_id": "Select an active workspace member from this store."}
            )

        ensure_workspace_ownership_transfer_or_403(actor_membership, target_membership)
        attrs["target_membership"] = target_membership
        return attrs

    @transaction.atomic
    def transfer(self) -> dict[str, object]:
        actor_membership = self.context["actor_membership"]
        target_membership: ShopMembership = self.validated_data["target_membership"]
        previous_owner_role: str = self.validated_data["previous_owner_role"]
        shop = actor_membership.shop

        actor_membership.role = previous_owner_role
        actor_membership.save(update_fields=["role", "updated_at"])

        target_membership.role = ShopMembership.Role.OWNER
        if target_membership.status != ShopMembership.Status.ACTIVE:
            target_membership.status = ShopMembership.Status.ACTIVE
            target_membership.save(update_fields=["role", "status", "updated_at"])
        else:
            target_membership.save(update_fields=["role", "updated_at"])

        shop.owner_user = target_membership.user
        shop.save(update_fields=["owner_user", "updated_at"])

        return {
            "shop_id": shop.id,
            "shop_name": shop.name,
            "previous_owner_membership_id": actor_membership.id,
            "previous_owner_email": actor_membership.user.email or actor_membership.email,
            "previous_owner_name": actor_membership.user.full_name
            or actor_membership.user.email
            or actor_membership.email,
            "previous_owner_role": actor_membership.role,
            "previous_owner_role_label": get_membership_role_label(actor_membership.role),
            "new_owner_membership_id": target_membership.id,
            "new_owner_email": target_membership.user.email or target_membership.email,
            "new_owner_name": target_membership.user.full_name
            or target_membership.user.email
            or target_membership.email,
            "transferred_at": target_membership.updated_at,
        }
