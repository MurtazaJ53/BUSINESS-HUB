from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from platform_apps.shops.models import ShopMembership, WorkspaceAccessSession


def evaluate_workspace_session_trust(session: WorkspaceAccessSession, *, now=None) -> dict[str, object]:
    now = now or timezone.now()
    reasons: list[str] = []
    score = 100

    if session.wipe_requested_at is not None and session.wipe_acknowledged_at is None:
        score = min(score, 5)
        reasons.append("Remote wipe is pending for this device.")

    if session.status == WorkspaceAccessSession.Status.REVOKED:
        score = min(score, 15)
        reasons.append("Workspace access has already been revoked.")

    if session.last_seen_at is None:
        score -= 14
        reasons.append("This device has not checked in recently enough to build trust.")
    else:
        age = now - session.last_seen_at
        if age > timedelta(days=7):
            score -= 34
            reasons.append("The device has been stale for more than 7 days.")
        elif age > timedelta(days=3):
            score -= 18
            reasons.append("The device has not checked in for more than 3 days.")
        elif age > timedelta(hours=24):
            score -= 8
            reasons.append("The device has been quiet for more than 24 hours.")

    if not (session.package_name or "").strip():
        score -= 10
        reasons.append("Package identity is missing.")

    if not (session.app_version or "").strip():
        score -= 8
        reasons.append("App version is missing.")

    release_channel = (session.release_channel or "").strip().lower()
    if release_channel and release_channel not in {"stable", "production"}:
        score -= 8
        reasons.append(f"Release channel is {release_channel}, not stable.")

    if not (session.release_tag or "").strip():
        score -= 4
        reasons.append("Release tag is missing.")

    is_management_role = session.membership_role_snapshot in {
        ShopMembership.Role.OWNER,
        ShopMembership.Role.ADMIN,
    }
    if is_management_role:
        has_second_factor = session.user.mfa_totp_enabled or session.user.passkey_enabled
        if not has_second_factor:
            score -= 28
            reasons.append("Owner/admin device belongs to a user without a second factor enrolled.")

    metadata = session.metadata_json if isinstance(session.metadata_json, dict) else {}
    integrity = str(metadata.get("device_integrity", "")).strip().lower()
    if integrity == "failed":
        score = min(score, 20)
        reasons.append("Device integrity check failed.")
    elif integrity == "unknown":
        score -= 6
        reasons.append("Device integrity status is unknown.")

    score = max(0, min(100, score))

    if session.wipe_requested_at is not None and session.wipe_acknowledged_at is None:
        level = "blocked"
        summary = "Remote wipe still pending."
    elif score >= 85:
        level = "trusted"
        summary = "Device posture looks healthy."
    elif score >= 60:
        level = "review"
        summary = "Device should be reviewed but is still usable."
    elif score >= 35:
        level = "risky"
        summary = "Device posture is risky and should be reviewed quickly."
    else:
        level = "blocked"
        summary = "Device posture is too risky for normal confidence."

    if not reasons and level == "trusted":
        reasons.append("Recent check-in, stable release posture, and no active security flags.")

    return {
        "trust_score": score,
        "trust_level": level,
        "trust_summary": summary,
        "trust_reasons": reasons,
    }
