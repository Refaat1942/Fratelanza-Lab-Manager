from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement

# Laboratory customers operate in Egypt — interpret UI date filters in local time.
LAB_TIMEZONE = ZoneInfo("Africa/Cairo")


def parse_date_param(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def date_start(d: date) -> datetime:
    local_start = datetime.combine(d, time.min, tzinfo=LAB_TIMEZONE)
    return local_start.astimezone(timezone.utc)


def date_end(d: date) -> datetime:
    local_end = datetime.combine(d, time.max, tzinfo=LAB_TIMEZONE)
    return local_end.astimezone(timezone.utc)


def apply_date_range(column: ColumnElement, date_from: date | None, date_to: date | None) -> list:
    """Return SQLAlchemy filter clauses for an inclusive datetime column range."""
    clauses = []
    if date_from:
        clauses.append(column >= date_start(date_from))
    if date_to:
        clauses.append(column <= date_end(date_to))
    return clauses
