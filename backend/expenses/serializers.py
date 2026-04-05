from rest_framework import serializers

from .models import ExpenseCategory, ExpenseEntry


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ["id", "name", "color", "created_at"]
        read_only_fields = ["id", "created_at"]


class ExpenseEntrySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = ExpenseEntry
        fields = [
            "id",
            "title",
            "notes",
            "amount",
            "spent_at",
            "category",
            "category_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "category_name", "created_at", "updated_at"]

    def validate_category(self, category):
        if category is None:
            return category

        request = self.context.get("request")
        if request is None or category.user_id != request.user.id:
            raise serializers.ValidationError("Category does not belong to the current user.")

        return category


class ExpenseCategorySummaryItemSerializer(serializers.Serializer):
    category_id = serializers.IntegerField(allow_null=True)
    category_name = serializers.CharField()
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_count = serializers.IntegerField()


class ExpenseSummarySerializer(serializers.Serializer):
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_count = serializers.IntegerField()
    by_category = ExpenseCategorySummaryItemSerializer(many=True)
