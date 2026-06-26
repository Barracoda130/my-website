from rest_framework import serializers

from .models import Account, Budget, Category, CategoryGroup, RecurringItem, Transaction


class UserOwnedModelSerializer(serializers.ModelSerializer):
    """Base serializer that assigns ownership to the authenticated user."""

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class CategoryGroupSerializer(UserOwnedModelSerializer):
    class Meta:
        model = CategoryGroup
        fields = ['id', 'name', 'type', 'sort_order', 'is_archived', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CategorySerializer(UserOwnedModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = Category
        fields = [
            'id', 'group', 'group_name', 'name', 'type', 'color', 'icon', 'sort_order',
            'is_archived', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'group_name', 'created_at', 'updated_at']

    def validate_group(self, value):
        if value.user != self.context['request'].user:
            raise serializers.ValidationError('Invalid category group.')
        return value

    def validate(self, attrs):
        group = attrs.get('group', getattr(self.instance, 'group', None))
        category_type = attrs.get('type', getattr(self.instance, 'type', None))
        if group and group.type != CategoryGroup.TYPE_MIXED and group.type != category_type:
            raise serializers.ValidationError({'type': 'Category type must match its group type unless the group is mixed.'})
        return attrs


class AccountSerializer(UserOwnedModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'name', 'type', 'opening_balance', 'is_archived', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TransactionSerializer(UserOwnedModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_color = serializers.CharField(source='category.color', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'account', 'account_name', 'category', 'category_name', 'category_color',
            'type', 'amount', 'date', 'description', 'payee', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'account_name', 'category_name', 'category_color', 'created_at', 'updated_at']

    def validate_account(self, value):
        if value.user != self.context['request'].user:
            raise serializers.ValidationError('Invalid account.')
        return value

    def validate_category(self, value):
        if value and value.user != self.context['request'].user:
            raise serializers.ValidationError('Invalid category.')
        return value

    def validate(self, attrs):
        tx_type = attrs.get('type', getattr(self.instance, 'type', None))
        category = attrs.get('category', getattr(self.instance, 'category', None))
        if tx_type in [Transaction.TYPE_INCOME, Transaction.TYPE_EXPENSE] and not category:
            raise serializers.ValidationError({'category': 'Income and expense transactions require a category.'})
        if category and tx_type in [Transaction.TYPE_INCOME, Transaction.TYPE_EXPENSE] and category.type != tx_type:
            raise serializers.ValidationError({'category': 'Category type must match transaction type.'})
        return attrs


class BudgetSerializer(UserOwnedModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_color = serializers.CharField(source='category.color', read_only=True)

    class Meta:
        model = Budget
        fields = ['id', 'category', 'category_name', 'category_color', 'month', 'amount', 'created_at', 'updated_at']
        read_only_fields = ['id', 'category_name', 'category_color', 'created_at', 'updated_at']

    def validate_category(self, value):
        if value.user != self.context['request'].user:
            raise serializers.ValidationError('Invalid category.')
        return value

    def validate_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError('Month must be the first day of the month.')
        return value


class RecurringItemSerializer(UserOwnedModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = RecurringItem
        fields = [
            'id', 'account', 'account_name', 'category', 'category_name', 'name', 'amount',
            'frequency', 'next_due_date', 'type', 'is_active', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'account_name', 'category_name', 'created_at', 'updated_at']

    def validate_account(self, value):
        if value.user != self.context['request'].user:
            raise serializers.ValidationError('Invalid account.')
        return value

    def validate_category(self, value):
        if value.user != self.context['request'].user:
            raise serializers.ValidationError('Invalid category.')
        return value