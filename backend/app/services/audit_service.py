from typing import Any, Optional
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog

REDACTED_AUDIT_VALUE = "[REDACTED]"
SENSITIVE_AUDIT_FIELDS = {
    "address",
    "date_of_birth",
    "dob",
    "email",
    "full_name",
    "full_name_ar",
    "national_id",
    "notes",
    "password",
    "password_hash",
    "phone",
    "refresh_token",
    "token",
}


def redact_sensitive_values(values: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if values is None:
        return None

    def _redact(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: REDACTED_AUDIT_VALUE if key.lower() in SENSITIVE_AUDIT_FIELDS and item is not None else _redact(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [_redact(item) for item in value]
        return value

    return _redact(jsonable_encoder(values))


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        *,
        tenant_id: Optional[UUID],
        user_id: Optional[UUID],
        action: str,
        module: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        old_values: Optional[dict[str, Any]] = None,
        new_values: Optional[dict[str, Any]] = None,
        branch_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        entry = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            branch_id=branch_id,
            action=action,
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=redact_sensitive_values(old_values),
            new_values=redact_sensitive_values(new_values),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry
