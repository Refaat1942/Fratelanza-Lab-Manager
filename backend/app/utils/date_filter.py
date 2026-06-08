from datetime import date, datetime, time, timezone

from sqlalchemy import ColumnElement


def parse_date_param(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def date_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def date_end(d: date) -> datetime:
    return datetime.combine(d, time.max, tzinfo=timezone.utc)


def apply_date_range(column: ColumnElement, date_from: date | None, date_to: date | None) -> list:
    """Return SQLAlchemy filter clauses for an inclusive datetime column range."""
    clauses = []
    if date_from:
        clauses.append(column >= date_start(date_from))
    if date_to:
        clauses.append(column <= date_end(date_to))
    return clauses
