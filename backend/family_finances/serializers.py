from decimal import Decimal

from rest_framework import serializers

from .models import Child, Family, FamilyMembership, FamilyTransaction, TransactionChildSplit


class FamilySerializer(serializers.ModelSerializer):
    class Meta:
        model = Family
        fields = ['id', 'name', 'code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'code', 'created_at', 'updated_at']


class ChildSerializer(serializers.ModelSerializer):
    class Meta:
        model = Child
        fields = ['id', 'name', 'date_of_birth', 'notes', 'active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TransactionChildSplitSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.name', read_only=True)

    class Meta:
        model = TransactionChildSplit
        fields = ['id', 'child', 'child_name', 'amount', 'percentage', 'created_at', 'updated_at']
        read_only_fields = ['id', 'child_name', 'created_at', 'updated_at']


class FamilyTransactionSerializer(serializers.ModelSerializer):
    splits = TransactionChildSplitSerializer(many=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    paid_by_display = serializers.CharField(source='get_paid_by_display', read_only=True)
    recurring_frequency_display = serializers.CharField(source='get_recurring_frequency_display', read_only=True)
    generated_from_title = serializers.CharField(source='generated_from.title', read_only=True)

    class Meta:
        model = FamilyTransaction
        fields = [
            'id', 'date', 'title', 'amount', 'currency', 'type', 'type_display', 'category',
            'category_display', 'paid_by', 'paid_by_display', 'counts_toward_fairness',
            'is_large_expense', 'split_between_children', 'recurring', 'recurring_frequency',
            'recurring_frequency_display', 'recurring_start_date', 'recurring_end_date', 'notes',
            'receipt_url', 'generated_from', 'generated_from_title', 'splits', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'generated_from', 'generated_from_title', 'created_at', 'updated_at']

    def validate_splits(self, value):
        family = self.context['family']
        if not value:
            raise serializers.ValidationError('Choose at least one child for this transaction.')
        child_ids = [split['child'].id for split in value]
        if len(child_ids) != len(set(child_ids)):
            raise serializers.ValidationError('Each child can only appear once in a split.')
        if any(split['child'].family_id != family.id for split in value):
            raise serializers.ValidationError('All split children must belong to your family.')
        return value

    def validate(self, attrs):
        recurring = attrs.get('recurring', getattr(self.instance, 'recurring', False))
        frequency = attrs.get('recurring_frequency', getattr(self.instance, 'recurring_frequency', FamilyTransaction.FREQUENCY_NONE))
        if recurring and frequency == FamilyTransaction.FREQUENCY_NONE:
            raise serializers.ValidationError({'recurring_frequency': 'Choose a recurring frequency.'})
        if not recurring:
            attrs['recurring_frequency'] = FamilyTransaction.FREQUENCY_NONE
            attrs['recurring_start_date'] = None
            attrs['recurring_end_date'] = None
        return attrs

    def _save_splits(self, transaction, splits):
        transaction.splits.all().delete()
        total = Decimal('0.00')
        for split in splits:
            total += split['amount']
            TransactionChildSplit.objects.create(transaction=transaction, **split)
        if total != transaction.amount:
            raise serializers.ValidationError({'splits': 'Split amounts must add up to the transaction amount.'})

    def create(self, validated_data):
        splits = validated_data.pop('splits')
        transaction = FamilyTransaction.objects.create(
            family=self.context['family'],
            created_by=self.context['request'].user,
            **validated_data,
        )
        self._save_splits(transaction, splits)
        return transaction

    def update(self, instance, validated_data):
        splits = validated_data.pop('splits', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if splits is not None:
            self._save_splits(instance, splits)
        return instance


class FamilyMembershipSerializer(serializers.ModelSerializer):
    family = FamilySerializer(read_only=True)

    class Meta:
        model = FamilyMembership
        fields = ['id', 'family', 'role', 'created_at']