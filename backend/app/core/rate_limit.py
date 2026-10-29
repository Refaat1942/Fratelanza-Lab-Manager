from slowapi import Limiter
from starlette.requests import Request

from app.core.config import get_settings

settings = get_settings()


def client_ip(request: Request) -> str:
    """Real client IP behind nginx (X-Real-IP is set by our proxy config), else the socket peer."""
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=client_ip, default_limits=[settings.RATE_LIMIT])
