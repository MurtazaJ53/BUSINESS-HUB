from __future__ import annotations

import hashlib
import json
import secrets
from unittest.mock import MagicMock, patch

from django.test import TestCase
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from rest_framework.test import APIClient

from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.shops.roles import normalize_membership_role
from platform_apps.users.authentication import bootstrap_memberships_from_firestore
from platform_apps.users.mfa import generate_totp_code
from platform_apps.users.models import PlatformUser, UserPasskeyCredential
from platform_apps.users.webauthn import get_webauthn_rp_id, webauthn_b64encode


def _cbor_encode(value):
    if isinstance(value, bool):
        return b"\xf5" if value else b"\xf4"
    if value is None:
        return b"\xf6"
    if isinstance(value, int):
        if value >= 0:
            return _cbor_encode_type_and_value(0, value)
        return _cbor_encode_type_and_value(1, -1 - value)
    if isinstance(value, bytes):
        return _cbor_encode_type_and_value(2, len(value)) + value
    if isinstance(value, str):
        encoded = value.encode("utf-8")
        return _cbor_encode_type_and_value(3, len(encoded)) + encoded
    if isinstance(value, list):
        return _cbor_encode_type_and_value(4, len(value)) + b"".join(
            _cbor_encode(item) for item in value
        )
    if isinstance(value, dict):
        return _cbor_encode_type_and_value(5, len(value)) + b"".join(
            _cbor_encode(key) + _cbor_encode(item) for key, item in value.items()
        )
    raise TypeError(f"Unsupported CBOR type: {type(value)!r}")


def _cbor_encode_type_and_value(major_type: int, value: int) -> bytes:
    if value < 24:
        return bytes([(major_type << 5) | value])
    if value < 256:
        return bytes([(major_type << 5) | 24, value])
    if value < 65536:
        return bytes([(major_type << 5) | 25]) + value.to_bytes(2, "big")
    if value < 2**32:
        return bytes([(major_type << 5) | 26]) + value.to_bytes(4, "big")
    return bytes([(major_type << 5) | 27]) + value.to_bytes(8, "big")


def _build_passkey_registration_payload(*, challenge_token: str, challenge: str):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_numbers = private_key.public_key().public_numbers()
    x = public_numbers.x.to_bytes(32, "big")
    y = public_numbers.y.to_bytes(32, "big")
    credential_id_bytes = secrets.token_bytes(18)
    cose_key = {
        1: 2,
        3: -7,
        -1: 1,
        -2: x,
        -3: y,
    }
    auth_data = (
        hashlib.sha256(get_webauthn_rp_id().encode("utf-8")).digest()
        + bytes([0x41])
        + (1).to_bytes(4, "big")
        + (b"\x00" * 16)
        + len(credential_id_bytes).to_bytes(2, "big")
        + credential_id_bytes
        + _cbor_encode(cose_key)
    )
    attestation_object = _cbor_encode(
        {
            "fmt": "none",
            "attStmt": {},
            "authData": auth_data,
        }
    )
    client_data_json = json.dumps(
        {
            "type": "webauthn.create",
            "challenge": challenge,
            "origin": "http://localhost:3000",
        },
        separators=(",", ":"),
    ).encode("utf-8")
    return (
        {
            "challenge_token": challenge_token,
            "credential_id": webauthn_b64encode(credential_id_bytes),
            "client_data_json": webauthn_b64encode(client_data_json),
            "attestation_object": webauthn_b64encode(attestation_object),
            "transports": ["internal"],
            "label": "Owner laptop",
        },
        private_key,
        webauthn_b64encode(credential_id_bytes),
    )


def _build_passkey_assertion_payload(
    *,
    challenge_token: str,
    challenge: str,
    credential_id: str,
    private_key,
):
    authenticator_data = (
        hashlib.sha256(get_webauthn_rp_id().encode("utf-8")).digest()
        + bytes([0x01])
        + (2).to_bytes(4, "big")
    )
    client_data_json = json.dumps(
        {
            "type": "webauthn.get",
            "challenge": challenge,
            "origin": "http://localhost:3000",
        },
        separators=(",", ":"),
    ).encode("utf-8")
    signed_data = authenticator_data + hashlib.sha256(client_data_json).digest()
    signature = private_key.sign(signed_data, ec.ECDSA(hashes.SHA256()))
    return {
        "challenge_token": challenge_token,
        "credential_id": credential_id,
        "client_data_json": webauthn_b64encode(client_data_json),
        "authenticator_data": webauthn_b64encode(authenticator_data),
        "signature": webauthn_b64encode(signature),
    }


class SessionBootstrapTests(TestCase):
    def test_session_bootstrap_returns_memberships(self):
        user = PlatformUser.objects.create_user(email="murtaza@example.com", full_name="Murtaza")
        shop = Shop.objects.create(
            name="Business Hub Pro",
            slug="business-hub-pro",
            settings_json={"plan_tier": "starter"},
        )
        ShopMembership.objects.create(
            user=user,
            shop=shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/v1/session/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["email"], "murtaza@example.com")
        self.assertFalse(response.json()["user"]["mfa_totp_enabled"])
        self.assertFalse(response.json()["user"]["passkey_enabled"])
        self.assertEqual(response.json()["user"]["passkey_count"], 0)
        self.assertTrue(response.json()["user"]["mfa_security_stamp"])
        self.assertEqual(len(response.json()["memberships"]), 1)
        membership = response.json()["memberships"][0]
        self.assertEqual(membership["role_label"], "Owner")
        self.assertEqual(membership["role_profile"], "owner_control")
        self.assertIn("business control", membership["role_summary"].lower())
        self.assertEqual(membership["shop"]["plan_tier"], "starter")
        self.assertFalse(membership["shop"]["enabled_features"]["expenses"])
        self.assertFalse(membership["shop"]["enabled_features"]["attendance"])

    def test_normalize_membership_role_maps_product_aliases(self):
        self.assertEqual(normalize_membership_role("cashier"), ShopMembership.Role.STAFF)
        self.assertEqual(normalize_membership_role("manager"), ShopMembership.Role.ADMIN)
        self.assertEqual(normalize_membership_role("viewer"), ShopMembership.Role.VIEWER)
        self.assertEqual(
            normalize_membership_role("staff", is_shop_owner=True),
            ShopMembership.Role.OWNER,
        )

    @patch("platform_apps.users.authentication.firestore.client")
    @patch("platform_apps.users.authentication.get_firebase_app", return_value=object())
    def test_bootstrap_repairs_owner_membership_role_from_firestore(
        self,
        _get_firebase_app,
        firestore_client_mock,
    ):
        user = PlatformUser.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            firebase_uid="owner-firebase-uid",
        )
        shop = Shop.objects.create(
            name="Demo Shop",
            slug="demo-shop",
            source_system="firebase",
            source_id="shop-001",
            source_shop_id="shop-001",
        )
        membership = ShopMembership.objects.create(
            user=user,
            shop=shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )

        user_doc = MagicMock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {
            "shopId": "shop-001",
            "role": "staff",
            "phone": "+91-9999999999",
        }
        shop_doc = MagicMock()
        shop_doc.exists = True
        shop_doc.to_dict.return_value = {
            "name": "Demo Shop",
            "ownerId": "owner-firebase-uid",
            "settings": {"plan_tier": "growth"},
        }

        users_collection = MagicMock()
        shops_collection = MagicMock()
        users_collection.document.return_value.get.return_value = user_doc
        shops_collection.document.return_value.get.return_value = shop_doc

        firestore_db = MagicMock()
        firestore_db.collection.side_effect = lambda name: {
            "users": users_collection,
            "shops": shops_collection,
        }[name]
        firestore_client_mock.return_value = firestore_db

        bootstrap_memberships_from_firestore(user)

        membership.refresh_from_db()
        shop.refresh_from_db()
        self.assertEqual(membership.role, ShopMembership.Role.OWNER)
        self.assertEqual(membership.status, ShopMembership.Status.ACTIVE)
        self.assertEqual(membership.phone, "+91-9999999999")
        self.assertEqual(shop.owner_user_id, user.id)


class SessionMfaTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_enroll_status_and_verify_flow(self):
        initial = self.client.get("/api/v1/session/mfa/")
        self.assertEqual(initial.status_code, 200)
        self.assertFalse(initial.json()["totp_enabled"])
        self.assertFalse(initial.json()["totp_pending_enrollment"])
        self.assertFalse(initial.json()["passkey_enabled"])
        self.assertEqual(initial.json()["passkey_count"], 0)

        enroll_response = self.client.post("/api/v1/session/mfa/enroll/", {}, format="json")
        self.assertEqual(enroll_response.status_code, 200)
        payload = enroll_response.json()
        self.assertFalse(payload["totp_enabled"])
        self.assertTrue(payload["totp_pending_enrollment"])
        self.assertTrue(payload["pending_manual_secret"])
        self.assertTrue(payload["pending_otpauth_uri"].startswith("otpauth://totp/"))

        self.user.refresh_from_db()
        self.assertTrue(self.user.mfa_totp_pending_secret)
        valid_code = generate_totp_code(self.user.mfa_totp_pending_secret)

        verify_response = self.client.post(
            "/api/v1/session/mfa/verify/",
            {"purpose": "enroll", "code": valid_code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, 200)
        verify_payload = verify_response.json()
        self.assertTrue(verify_payload["status"]["totp_enabled"])
        self.assertFalse(verify_payload["status"]["totp_pending_enrollment"])
        self.assertTrue(verify_payload["verified_until"])

        self.user.refresh_from_db()
        self.assertTrue(self.user.mfa_totp_enabled)
        self.assertFalse(self.user.mfa_totp_pending_secret)
        self.assertIsNotNone(self.user.mfa_totp_enabled_at)
        self.assertIsNotNone(self.user.mfa_totp_last_verified_at)

    def test_challenge_and_disable_flow(self):
        self.client.post("/api/v1/session/mfa/enroll/", {}, format="json")
        self.user.refresh_from_db()
        enroll_code = generate_totp_code(self.user.mfa_totp_pending_secret)
        self.client.post(
            "/api/v1/session/mfa/verify/",
            {"purpose": "enroll", "code": enroll_code},
            format="json",
        )

        self.user.refresh_from_db()
        challenge_code = generate_totp_code(self.user.mfa_totp_secret)
        challenge_response = self.client.post(
            "/api/v1/session/mfa/verify/",
            {"purpose": "challenge", "code": challenge_code},
            format="json",
        )
        self.assertEqual(challenge_response.status_code, 200)
        self.assertTrue(challenge_response.json()["status"]["totp_enabled"])

        disable_code = generate_totp_code(self.user.mfa_totp_secret)
        disable_response = self.client.post(
            "/api/v1/session/mfa/disable/",
            {"code": disable_code},
            format="json",
        )
        self.assertEqual(disable_response.status_code, 200)
        self.assertFalse(disable_response.json()["totp_enabled"])

        self.user.refresh_from_db()
        self.assertFalse(self.user.mfa_totp_secret)
        self.assertFalse(self.user.mfa_totp_pending_secret)
        self.assertIsNone(self.user.mfa_totp_enabled_at)
        self.assertIsNone(self.user.mfa_totp_last_verified_at)

    def test_invalid_code_is_rejected(self):
        self.client.post("/api/v1/session/mfa/enroll/", {}, format="json")
        response = self.client.post(
            "/api/v1/session/mfa/verify/",
            {"purpose": "enroll", "code": "000000"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("code", response.json())

    def test_passkey_register_verify_and_delete_flow(self):
        begin_response = self.client.post(
            "/api/v1/session/passkeys/register/begin/",
            {},
            format="json",
        )
        self.assertEqual(begin_response.status_code, 200)
        begin_payload = begin_response.json()
        registration_payload, private_key, credential_id = _build_passkey_registration_payload(
            challenge_token=begin_payload["challenge_token"],
            challenge=begin_payload["options"]["challenge"],
        )

        finish_response = self.client.post(
            "/api/v1/session/passkeys/register/finish/",
            registration_payload,
            format="json",
        )
        self.assertEqual(finish_response.status_code, 201)
        self.assertTrue(finish_response.json()["status"]["passkey_enabled"])
        self.assertEqual(finish_response.json()["status"]["passkey_count"], 1)

        passkey_list = self.client.get("/api/v1/session/passkeys/")
        self.assertEqual(passkey_list.status_code, 200)
        self.assertEqual(len(passkey_list.json()), 1)
        passkey_id = passkey_list.json()[0]["id"]

        verify_begin_response = self.client.post(
            "/api/v1/session/passkeys/verify/begin/",
            {},
            format="json",
        )
        self.assertEqual(verify_begin_response.status_code, 200)
        verify_begin_payload = verify_begin_response.json()
        assertion_payload = _build_passkey_assertion_payload(
            challenge_token=verify_begin_payload["challenge_token"],
            challenge=verify_begin_payload["options"]["challenge"],
            credential_id=credential_id,
            private_key=private_key,
        )
        verify_finish_response = self.client.post(
            "/api/v1/session/passkeys/verify/finish/",
            assertion_payload,
            format="json",
        )
        self.assertEqual(verify_finish_response.status_code, 200)
        self.assertEqual(
            verify_finish_response.json()["credential"]["credential_id"],
            credential_id,
        )
        self.assertTrue(verify_finish_response.json()["status"]["passkey_enabled"])
        self.assertTrue(verify_finish_response.json()["verified_until"])

        delete_response = self.client.delete(f"/api/v1/session/passkeys/{passkey_id}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertFalse(delete_response.json()["status"]["passkey_enabled"])
        self.assertEqual(delete_response.json()["status"]["passkey_count"], 0)
        self.assertFalse(UserPasskeyCredential.objects.get(id=passkey_id).is_active)
