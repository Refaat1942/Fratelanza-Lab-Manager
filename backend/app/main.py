from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.core.config import get_settings

settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT])


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
    docs_url="/docs",
    redoc_url="/redoc",
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

_uploads = Path("uploads")
_uploads.mkdir(exist_ok=True)
(_uploads / "logos").mkdir(parents=True, exist_ok=True)
app.mount(
    f"{settings.API_V1_PREFIX}/uploads",
    StaticFiles(directory=str(_uploads)),
    name="uploads",
)


@app.get("/health")
@limiter.limit("30/minute")
async def health(request: Request):
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "build": settings.BUILD_SHA,
    }


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})
