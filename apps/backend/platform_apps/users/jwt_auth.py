"""Self-contained JWT auth (HS256, signed with Django SECRET_KEY).

Lives alongside the Firebase adapter: both use ``Authorization: Bearer <token>``,
but our tokens are HS256-signed with SECRET_KEY while Firebase tokens are
RS256-signed by Google. [JWTAuthentication] only claims a token whose signature
verifies against our secret and returns ``None`` otherwise, so the Firebase
authenticator still gets its turn. This gives sync clients a token flow that
works without a live Firebase project.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

User = get_user_model()

_ALGORITHM = "HS256"
_ISSUER = "business-hub"
ACCESS_TOKEN_LIFETIME = timedelta(hours=12)
REFRESH_TOKEN_LIFETIME = timedelta(days=30)


def _encode(*, user, token_type: str, lifetime: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "token_type": token_type,
        "iss": _ISSUER,
        "iat": int(now.timestamp()),
        "exp": int((now + lifetime).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGORITHM)


def issue_tokens(user) -> dict[str, object]:
    """Return an access+refresh token pair for ``user``."""
    return {
        "access": _encode(user=user, token_type="access", lifetime=ACCESS_TOKEN_LIFETIME),
        "refresh": _encode(user=user, token_type="refresh", lifetime=REFRESH_TOKEN_LIFETIME),
        "token_type": "Bearer",
        "expires_in": int(ACCESS_TOKEN_LIFETIME.total_seconds()),
    }


def decode_token(token: str, *, expected_type: str) -> dict:
    """Decode one of *our* tokens or raise AuthenticationFailed.

    Raises ``InvalidTokenError`` (subclass) when the token is not ours so callers
    can distinguish "not my token" from "my token but bad".
    """
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[_ALGORITHM],
        issuer=_ISSUER,
        options={"require": ["exp", "sub", "token_type"]},
    )
    if payload.get("token_type") != expected_type:
        # Not the token we expected here (e.g. an access token at the refresh
        # endpoint). Raise the jwt error type so callers treat it like any other
        # invalid token (JWTAuthentication falls through; refresh view -> 401).
        raise jwt.InvalidTokenError("Wrong token type.")
    return payload


class JWTAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header or header[0].lower() != self.keyword.lower().encode():
            return None
        if len(header) != 2:
            return None
        token = header[1].decode()

        try:
            payload = decode_token(token, expected_type="access")
        except jwt.ExpiredSignatureError as exc:
            # Signature verified => it is our token, just expired.
            raise exceptions.AuthenticationFailed("Access token has expired.") from exc
        except jwt.InvalidTokenError:
            # Not our token (e.g. a Firebase ID token) — let the next authenticator try.
            return None

        try:
            user = User.objects.get(pk=payload["sub"])
        except (User.DoesNotExist, ValueError, KeyError) as exc:
            raise exceptions.AuthenticationFailed("User for token not found.") from exc
        if not user.is_active:
            raise exceptions.AuthenticationFailed("User is inactive.")
        return (user, token)

    def authenticate_header(self, request):
        return self.keyword
