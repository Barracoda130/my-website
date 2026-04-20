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
            "is_recurring",
            "recurring_interval",
            "recurring_end_date",
            "recurring_payment_count",
            "recurrence_group_id",
            "recurrence_sequence",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "member_name",
            "recurrence_group_id",
            "recurrence_sequence",
            "created_at",
            "updated_at",
        ]

    def validate_member(self, value):
        request = self.context["request"]
        if value.household_id != request.household.id:
            raise serializers.ValidationError("Member must belong to your household.")
        if value.role != FamilyMember.Role.CHILD:
            raise serializers.ValidationError("Allowances can only be assigned to children.")
        return value

    def validate(self, attrs):
        is_recurring = bool(attrs.get("is_recurring"))
        recurring_interval = attrs.get("recurring_interval")
        recurring_end_date = attrs.get("recurring_end_date")
        recurring_payment_count = attrs.get("recurring_payment_count")
        received_at = attrs.get("received_at")

        if is_recurring:
            if not recurring_interval:
                raise serializers.ValidationError(
                    {"recurring_interval": "Recurring interval is required when recurring is enabled."}
                )

            has_end_date = recurring_end_date is not None
            has_payment_count = recurring_payment_count is not None
            if has_end_date == has_payment_count:
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            "Set either recurring_end_date or recurring_payment_count, but not both."
                        ]
                    }
                )

            if recurring_payment_count is not None and recurring_payment_count < 1:
                raise serializers.ValidationError(
                    {"recurring_payment_count": "Recurring payment count must be at least 1."}
                )

            if recurring_end_date is not None and received_at is not None and recurring_end_date < received_at:
                raise serializers.ValidationError(
                    {"recurring_end_date": "Recurring end date must be on or after received_at."}
                )
        else:
            if recurring_interval or recurring_end_date or recurring_payment_count:
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            "Recurring fields can only be set when is_recurring is true."
                        ]
                    }
                )

        return attrs


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
