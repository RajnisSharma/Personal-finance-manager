import django_filters

from .models import Transaction


class TransactionFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    min_amount = django_filters.NumberFilter(field_name="amount", lookup_expr="gte")
    max_amount = django_filters.NumberFilter(field_name="amount", lookup_expr="lte")
    category = django_filters.NumberFilter(field_name="category__id")
    description = django_filters.CharFilter(field_name="description", lookup_expr="icontains")
    merchant_name = django_filters.CharFilter(field_name="merchant_name", lookup_expr="icontains")
    account = django_filters.NumberFilter(field_name="account__id")
    transaction_type = django_filters.CharFilter(field_name="transaction_type", lookup_expr="iexact")
    is_recurring = django_filters.BooleanFilter(field_name="is_recurring")

    class Meta:
        model = Transaction
        fields = [
            "date_from",
            "date_to",
            "min_amount",
            "max_amount",
            "category",
            "description",
            "merchant_name",
            "account",
            "transaction_type",
            "is_recurring",
        ]
