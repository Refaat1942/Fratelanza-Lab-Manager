import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(
    subject: str,
    *,
    tenant_id: Optional[UUID] = None,
    database_name: Optional[str] = None,
    role: Optional[str] = None,
    permissions: Optional[list[str]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    # jti makes every token unique — two logins in the same second would otherwise
    # produce identical refresh tokens and collide on refresh_tokens.token_hash.
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "access", "jti": secrets.token_hex(8)}
    if tenant_id:
        payload["tenant_id"] = str(tenant_id)
    if database_name:
        payload["database_name"] = database_name
    if role:
        payload["role"] = role
    if permissions:
        payload["permissions"] = permissions
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    subject: str,
    *,
    tenant_id: Optional[UUID] = None,
    database_name: Optional[str] = None,
    role: Optional[str] = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "refresh", "jti": secrets.token_hex(8)}
    if tenant_id:
        payload["tenant_id"] = str(tenant_id)
    if database_name:
        payload["database_name"] = database_name
    if role:
        payload["role"] = role
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_demo_access_token(tenant_id: UUID, expires_at: datetime) -> str:
    """Legacy passwordless demo link (JWT). Still accepted for links already sent."""
    payload: dict[str, Any] = {"sub": str(tenant_id), "exp": expires_at, "type": "demo_access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _demo_signature(tenant_id: UUID) -> str:
    digest = hmac.new(settings.SECRET_KEY.encode(), f"demo-access:{tenant_id}".encode(), hashlib.sha256)
    return digest.hexdigest()[:20]


def create_demo_access_key(tenant_id: UUID) -> str:
    """Short demo link key: only [0-9a-f-], so WhatsApp and SMS can't mangle it.
    Validity (expiry, pause) is enforced by the demo's subscription, not the key."""
    return f"{tenant_id}-{_demo_signature(tenant_id)}"


def verify_demo_access_key(key: str) -> Optional[UUID]:
    tenant_part, _, signature = key.strip().rpartition("-")
    try:
        tenant_id = UUID(tenant_part)
    except ValueError:
        return None
    if not hmac.compare_digest(signature, _demo_signature(tenant_id)):
        return None
    return tenant_id


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def verify_token(token: str, token_type: str = "access") -> Optional[dict[str, Any]]:
    try:
        payload = decode_token(token)
        if payload.get("type") != token_type:
            return None
        return payload
    except JWTError:
        return None
