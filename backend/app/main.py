from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.limiter import limiter
from app.middleware.security_headers import SecurityHeadersMiddleware

settings = get_settings()
is_production = settings.ENVIRONMENT == "production"


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.bootstrap.admin_credentials import ensure_demo_admin, ensure_platform_admin

    try:
        await ensure_platform_admin()
        await ensure_demo_admin()
    except Exception as exc:
        print(f"Admin bootstrap skipped: {exc}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="LabMaster Egypt - Multi-tenant SaaS ERP/LIMS API",
    lifespan=lifespan,
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Id", "Accept", "Accept-Language"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
@limiter.limit("30/minute")
async def health(request: Request):
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})
