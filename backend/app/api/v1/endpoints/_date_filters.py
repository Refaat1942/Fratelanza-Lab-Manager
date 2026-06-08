from datetime import date, datetime, time, timezone


def date_range_bounds(date_from: date | None, date_to: date | None) -> tuple[datetime | None, datetime | None]:
    start = datetime.combine(date_from, time.min, timezone.utc) if date_from else None
    end = datetime.combine(date_to, time.max, timezone.utc) if date_to else None
    return start, end

