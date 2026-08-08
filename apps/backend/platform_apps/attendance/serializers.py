from __future__ import annotations

from rest_framework import serializers

from platform_apps.attendance.models import AttendanceSession


class AttendanceSummarySerializer(serializers.Serializer):
    total_sessions = serializers.IntegerField()
    present_count = serializers.IntegerField()
    leave_count = serializers.IntegerField()
    active_workers_today = serializers.IntegerField()


class AttendanceSessionSerializer(serializers.ModelSerializer):
    membership_id = serializers.UUIDField(source="membership.id", read_only=True)
    member_name = serializers.SerializerMethodField()
    member_role = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = (
            "id",
            "membership_id",
            "member_name",
            "member_role",
            "session_date",
            "clock_in_at",
            "clock_out_at",
            "status",
            "total_hours",
            "overtime_hours",
            "bonus_amount",
            "note",
            "tombstone",
        )
        read_only_fields = ("id", "membership_id", "member_name", "member_role")

    def get_member_name(self, obj):
        return obj.membership.user.full_name or obj.membership.user.email

    def get_member_role(self, obj):
        return obj.membership.role


class AttendanceSessionWriteSerializer(serializers.ModelSerializer):
    membership_id = serializers.UUIDField(write_only=True)
    member_name = serializers.SerializerMethodField(read_only=True)
    member_role = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AttendanceSession
        fields = (
            "id",
            "membership_id",
            "member_name",
            "member_role",
            "session_date",
            "clock_in_at",
            "clock_out_at",
            "status",
            "total_hours",
            "overtime_hours",
            "bonus_amount",
            "note",
            "tombstone",
        )
        read_only_fields = ("id", "member_name", "member_role", "tombstone")

    def get_member_name(self, obj):
        return obj.membership.user.full_name or obj.membership.user.email

    def get_member_role(self, obj):
        return obj.membership.role

    def validate_membership_id(self, value):
        membership_map = self.context["membership_map"]
        if str(value) not in membership_map:
            raise serializers.ValidationError("Attendance membership is outside the current shop scope.")
        return value

    def create(self, validated_data):
        membership_id = str(validated_data.pop("membership_id"))
        membership = self.context["membership_map"][membership_id]
        return AttendanceSession.objects.create(
            shop=self.context["shop"],
            membership=membership,
            **validated_data,
        )

    def update(self, instance, validated_data):
        validated_data.pop("membership_id", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
