"""Employee invitation lifecycle: create, deliver, accept, revoke."""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from platform_apps.audit.services import create_workspace_audit_event
from platform_apps.common.emailer import send_invite_email
from platform_apps.shops.models import ShopInvite, ShopMembership
from platform_apps.shops.permissions import can_assign_workspace_role

User = get_user_model()

INVITE_TTL = timedelta(days=7)


class InvalidInviteCredentials(exceptions.APIException):
    # Explicit 401: DRF maps AuthenticationFailed to 403 when a view has no
    # authenticators, which is misleading for a wrong-password case.
    status_code = 401
    default_detail = (
        "An account with this email exists - enter its password to join."
    )
    default_code = "invalid_credentials"


def _role_label(role: str) -> str:
    return dict(ShopMembership.Role.choices).get(role, role.title())


def build_invite_link(token: str) -> str:
    """Deep link encoded in the invite QR and shared with the invitee. The
    mobile app registers the `businesshub://` scheme and routes join?token=...
    into the accept-invite screen; scanned as plain text it still yields the
    token."""
    return f"businesshub://join?token={token}"


@transaction.atomic
def create_invite(*, shop, invited_by, actor_role, email, role, message=""):
    """Create a pending invite, email it, and return it. Raises if the actor
    may not assign the requested role."""
    email = email.strip().lower()
    role = (role or ShopMembership.Role.STAFF).strip()
    if role not in dict(ShopMembership.Role.choices):
        raise exceptions.ValidationError({"role": "Unknown role."})
    if not can_assign_workspace_role(actor_role, role):
        raise exceptions.PermissionDenied(
            "Your role can't assign that role."
        )

    # If they already have an ACTIVE membership, there's nothing to invite.
    # ShopMembership.email is encrypted and can't be filtered, so resolve the
    # person through the (unencrypted, indexed) User.email and check membership
    # by the user FK instead.
    existing_user = User.objects.filter(email__iexact=email).first()
    if existing_user and ShopMembership.objects.filter(
        shop=shop, user=existing_user, status=ShopMembership.Status.ACTIVE
    ).exists():
        raise exceptions.ValidationError(
            {"email": "This person is already an active member of the shop."}
        )

    # Supersede any earlier pending invite to the same email for this shop.
    ShopInvite.objects.filter(
        shop=shop, email__iexact=email, status=ShopInvite.Status.PENDING
    ).update(status=ShopInvite.Status.REVOKED)

    invite = ShopInvite.objects.create(
        shop=shop,
        token=secrets.token_urlsafe(24),
        email=email,
        role=role,
        message=message.strip()[:280],
        invited_by_user=invited_by,
        expires_at=timezone.now() + INVITE_TTL,
        source_system="invitation",
    )

    email_result = send_invite_email(
        to=email,
        shop_name=shop.name,
        role_label=_role_label(role),
        invite_code=invite.token,
        inviter=getattr(invited_by, "full_name", "") or "",
    )
    # Expose the real delivery outcome to the caller (never blocks the invite).
    invite._email_result = email_result

    create_workspace_audit_event(
        shop=shop,
        actor_user=invited_by,
        actor_role=actor_role,
        category="team",
        event_type="invite_sent",
        entity_type="invite",
        entity_id=str(invite.id),
        entity_label=email,
        summary=f"Invited {email} as {_role_label(role)}.",
        source_surface="invitation",
    )
    return invite


def get_live_invite(token: str) -> ShopInvite:
    invite = ShopInvite.objects.select_related("shop").filter(token=token).first()
    if invite is None:
        raise exceptions.NotFound("That invite code isn't valid.")
    if invite.status == ShopInvite.Status.REVOKED:
        raise exceptions.PermissionDenied("This invite was revoked.")
    if invite.status == ShopInvite.Status.ACCEPTED:
        raise exceptions.PermissionDenied("This invite was already used.")
    if not invite.is_live:
        # lazily flip an expired-but-still-pending invite
        if invite.status == ShopInvite.Status.PENDING:
            invite.status = ShopInvite.Status.EXPIRED
            invite.save(update_fields=["status"])
        raise exceptions.PermissionDenied("This invite has expired.")
    return invite


@transaction.atomic
def accept_invite(*, token: str, name: str, password: str):
    """Accept an invite. Creates the user if new (using the provided password),
    or verifies the password if the account exists, then activates membership.
    Returns (user, shop, membership)."""
    invite = get_live_invite(token)
    email = invite.email
    user = User.objects.filter(email__iexact=email).first()

    if user is None:
        if len(password or "") < 8:
            raise exceptions.ValidationError(
                {"password": "Choose a password of at least 8 characters."}
            )
        user = User(
            email=email,
            full_name=(name or "").strip() or email.split("@")[0],
            is_active=True,
            source_system="invitation",
        )
        user.set_password(password)
        user.save()
    else:
        # Existing account: the password must match (accept doubles as login).
        if authenticate(username=email, password=password) is None:
            raise InvalidInviteCredentials()

    membership, _ = ShopMembership.objects.get_or_create(
        shop=invite.shop,
        user=user,
        defaults={"role": invite.role, "email": email},
    )
    membership.role = invite.role
    membership.status = ShopMembership.Status.ACTIVE
    membership.email = email
    membership.save(update_fields=["role", "status", "email", "updated_at"])

    invite.status = ShopInvite.Status.ACCEPTED
    invite.accepted_at = timezone.now()
    invite.save(update_fields=["status", "accepted_at", "updated_at"])

    create_workspace_audit_event(
        shop=invite.shop,
        actor_user=user,
        actor_role=invite.role,
        category="team",
        event_type="invite_accepted",
        entity_type="membership",
        entity_id=str(membership.id),
        entity_label=email,
        summary=f"{email} joined as {_role_label(invite.role)}.",
        source_surface="invitation",
    )
    return user, invite.shop, membership


@transaction.atomic
def revoke_invite(*, shop, invite_id, actor_user, actor_role) -> ShopInvite:
    invite = ShopInvite.objects.filter(shop=shop, id=invite_id).first()
    if invite is None:
        raise exceptions.NotFound("Invite not found.")
    if invite.status == ShopInvite.Status.PENDING:
        invite.status = ShopInvite.Status.REVOKED
        invite.save(update_fields=["status", "updated_at"])
        create_workspace_audit_event(
            shop=shop,
            actor_user=actor_user,
            actor_role=actor_role,
            category="team",
            event_type="invite_revoked",
            entity_type="invite",
            entity_id=str(invite.id),
            entity_label=invite.email,
            summary=f"Revoked invite to {invite.email}.",
            source_surface="invitation",
        )
    return invite
