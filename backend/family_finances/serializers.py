from rest_framework import serializers

from .models import AllowanceEntry, FamilyMember, SpendEntry


class FamilyMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyMember
        fields = ["id", "name", "role", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class AllowanceEntrySerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.name", read_only=True)

    class Meta:
        model = AllowanceEntry
        fields = [
            "id",
            "member",
            "member_name",
            "amount",
            "received_at",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "member_name", "created_at", "updated_at"]

    def validate_member(self, value):
        request = self.context["request"]
        if value.household_id != request.household.id:
            raise serializers.ValidationError("Member must belong to your household.")
        if value.role != FamilyMember.Role.CHILD:
            raise serializers.ValidationError("Allowances can only be assigned to children.")
        return value


class SpendEntrySerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.name", read_only=True)
    threshold_significant = serializers.BooleanField(read_only=True)
    effective_significant = serializers.BooleanField(read_only=True)

    class Meta:
        model = SpendEntry
        fields = [
            "id",
            "member",
            "member_name",
            "kind",
            "title",
            "amount",
            "spent_at",
            "payer",
            "manual_significant",
            "threshold_significant",
            "effective_significant",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "member_name",
            "threshold_significant",
            "effective_significant",
            "created_at",
            "updated_at",
        ]

    def validate_member(self, value):
        request = self.context["request"]
        if value.household_id != request.household.id:
            raise serializers.ValidationError("Member must belong to your household.")
        if value.role != FamilyMember.Role.CHILD:
            raise serializers.ValidationError("Spend entries can only be tracked against children.")
        return value


class FamilyMemberComparisonSerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    member_name = serializers.CharField()
    allowance_received = serializers.DecimalField(max_digits=12, decimal_places=2)
    purchase_spend = serializers.DecimalField(max_digits=12, decimal_places=2)
    holiday_spend = serializers.DecimalField(max_digits=12, decimal_places=2)
    parent_paid_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    child_paid_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_position = serializers.DecimalField(max_digits=12, decimal_places=2)


class FamilyComparisonSummarySerializer(serializers.Serializer):
    members = FamilyMemberComparisonSerializer(many=True)


class PayerBreakdownEntrySerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    member_name = serializers.CharField()
    parent_paid_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    child_paid_total = serializers.DecimalField(max_digits=12, decimal_places=2)


class PayerBreakdownSerializer(serializers.Serializer):
    overall_parent_paid_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    overall_child_paid_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    members = PayerBreakdownEntrySerializer(many=True)


class CategoryComparisonEntrySerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    member_name = serializers.CharField()
    significant_purchase_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    holiday_total = serializers.DecimalField(max_digits=12, decimal_places=2)


class CategoryComparisonSerializer(serializers.Serializer):
    members = CategoryComparisonEntrySerializer(many=True)
