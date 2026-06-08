from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.rate_limit import limiter

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_production_safety()
    if settings.is_production:
        yield
        return

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
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
@limiter.limit("30/minute")
async def health(request: Request):
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})
