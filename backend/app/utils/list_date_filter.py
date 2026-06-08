from datetime import date

from sqlalchemy import ColumnElement

from app.utils.date_filter import apply_date_range


def filter_by_entry_date(
    query,
    column: ColumnElement,
    date_from: date | None,
    date_to: date | None,
):
    """Filter list queries by record entry/created date."""
    for clause in apply_date_range(column, date_from, date_to):
        query = query.where(clause)
    return query
