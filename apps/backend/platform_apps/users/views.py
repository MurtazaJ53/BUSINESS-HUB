from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.shops.models import ShopMembership
from platform_apps.users.authentication import bootstrap_memberships_from_firestore
from platform_apps.users.serializers import (
    SessionMembershipSerializer,
    SessionUserSerializer,
    UserPasskeyAssertionBeginSerializer,
    UserPasskeyAssertionFinishSerializer,
    UserPasskeyCredentialSerializer,
    UserPasskeyDeleteSerializer,
    UserPasskeyRegistrationBeginSerializer,
    UserPasskeyRegistrationFinishSerializer,
    UserMfaDisableSerializer,
    UserMfaEnrollSerializer,
    UserMfaStatusSerializer,
    UserMfaVerifySerializer,
    build_user_mfa_status_payload,
)


class SessionBootstrapView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bootstrap_memberships_from_firestore(request.user)
        memberships = (
            ShopMembership.objects.select_related("shop")
            .filter(user=request.user)
            .order_by("shop__name")
        )

        active_memberships = [membership for membership in memberships if membership.status == ShopMembership.Status.ACTIVE]
        requested_shop_id = request.query_params.get("shopId")
        allowed_shop_ids = {str(membership.shop_id) for membership in active_memberships}
        active_shop_id = (
            requested_shop_id
            if requested_shop_id and requested_shop_id in allowed_shop_ids
            else (str(active_memberships[0].shop_id) if active_memberships else None)
        )

        return Response(
            {
                "user": SessionUserSerializer(request.user).data,
                "memberships": SessionMembershipSerializer(memberships, many=True).data,
                "active_shop_id": active_shop_id,
            }
        )


class SessionMfaStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMfaStatusSerializer(build_user_mfa_status_payload(request.user)).data)


class SessionMfaEnrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserMfaEnrollSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        payload = serializer.save(user=request.user)
        return Response(UserMfaStatusSerializer(payload).data)


class SessionMfaVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserMfaVerifySerializer(
            data=request.data,
            context={"user": request.user},
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save(user=request.user)
        return Response(
            {
                "status": UserMfaStatusSerializer(result["status"]).data,
                "verified_at": result["verified_at"],
                "verified_until": result["verified_until"],
            }
        )


class SessionMfaDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserMfaDisableSerializer(
            data=request.data,
            context={"user": request.user},
        )
        serializer.is_valid(raise_exception=True)
        payload = serializer.save(user=request.user)
        return Response(UserMfaStatusSerializer(payload).data, status=status.HTTP_200_OK)


class SessionPasskeyListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        credentials = request.user.passkeys.filter(is_active=True).order_by(
            "-last_verified_at",
            "-updated_at",
        )
        return Response(UserPasskeyCredentialSerializer(credentials, many=True).data)


class SessionPasskeyRegistrationBeginView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserPasskeyRegistrationBeginSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.save(user=request.user))


class SessionPasskeyRegistrationFinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserPasskeyRegistrationFinishSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        credential = serializer.save(user=request.user)
        return Response(
            {
                "credential": UserPasskeyCredentialSerializer(credential).data,
                "status": UserMfaStatusSerializer(
                    build_user_mfa_status_payload(request.user)
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SessionPasskeyAssertionBeginView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserPasskeyAssertionBeginSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.save(user=request.user))


class SessionPasskeyAssertionFinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserPasskeyAssertionFinishSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        result = serializer.save(user=request.user)
        return Response(
            {
                "credential": UserPasskeyCredentialSerializer(result["credential"]).data,
                "status": UserMfaStatusSerializer(result["status"]).data,
                "verified_at": result["verified_at"],
                "verified_until": result["verified_until"],
            }
        )


class SessionPasskeyDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, passkey_id):
        serializer = UserPasskeyDeleteSerializer(data={"passkey_id": passkey_id})
        serializer.is_valid(raise_exception=True)
        credential = serializer.save(user=request.user)
        return Response(
            {
                "credential": UserPasskeyCredentialSerializer(credential).data,
                "status": UserMfaStatusSerializer(
                    build_user_mfa_status_payload(request.user)
                ).data,
            }
        )
