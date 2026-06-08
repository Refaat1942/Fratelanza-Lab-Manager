from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.rate_limit import limiter

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if app.state.settings.BOOTSTRAP_ADMIN_ACCOUNTS:
        from app.bootstrap.admin_credentials import ensure_demo_admin, ensure_platform_admin

        try:
            await ensure_platform_admin()
            await ensure_demo_admin()
        except Exception as exc:
            print(f"Admin bootstrap skipped: {exc}")
    yield


def create_app(settings_override: Settings | None = None) -> FastAPI:
    app_settings = settings_override or get_settings()
    docs_url = "/docs" if app_settings.ENABLE_API_DOCS else None
    redoc_url = "/redoc" if app_settings.ENABLE_API_DOCS else None
    openapi_url = f"{app_settings.API_V1_PREFIX}/openapi.json" if app_settings.ENABLE_API_DOCS else None

    app = FastAPI(
        title=app_settings.APP_NAME,
        version=app_settings.APP_VERSION,
        description="LabMaster Egypt - Multi-tenant SaaS ERP/LIMS API",
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )
    app.state.settings = app_settings
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if request.url.path.startswith(f"{app_settings.API_V1_PREFIX}/auth"):
            response.headers.setdefault("Cache-Control", "no-store")
        if app_settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.get("/health")
    @limiter.limit("30/minute")
    async def health(request: Request):
        current_settings = request.app.state.settings
        return {"status": "healthy", "app": current_settings.APP_NAME, "version": current_settings.APP_VERSION}

    app.include_router(api_router, prefix=app_settings.API_V1_PREFIX)
    return app


app = create_app(settings)
