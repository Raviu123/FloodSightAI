from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
from app.core.config import settings
from app.api.v1.api import api_router
from app.core.logging_config import logger
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks - ensure tables exist
    try:
        init_db()
    except Exception as e:
        print(f"[WARN] Database auto-init warning: {e}")
    print(f"\n\033[1;36m======================================================================\033[0m")
    print(f"\033[1;32m  {settings.PROJECT_NAME} v{settings.VERSION} READY\033[0m")
    print(f"\033[36m  Environment:\033[0m {settings.ENVIRONMENT} | \033[36mAPI:\033[0m {settings.API_V1_STR}")
    print(f"\033[1;36m======================================================================\033[0m\n")
    yield
    # Shutdown tasks
    print(f"\n[INFO] {settings.PROJECT_NAME} shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="FastAPI Backend for FloodShield AI — Coastal Flood Intelligence & Early Warning System",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Robust CORS Configuration for Next.js & Local Development
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    client_host = request.client.host if request.client else "unknown"
    client_port = request.client.port if request.client else ""
    client_str = f"{client_host}:{client_port}" if client_port else client_host
    
    # Ignore noisy internal favicon/docs polling if desired, but log all API requests
    path = request.url.path
    is_api = path.startswith("/api") or path == "/"

    start_time = time.perf_counter()
    if is_api:
        logger.log_request_start(request.method, path, client_str)

    try:
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        if is_api:
            logger.log_request_end(request.method, path, response.status_code, duration_ms)
        return response
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        if is_api:
            logger.log_request_end(request.method, path, 500, duration_ms)
        raise e


# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to FloodShield AI API",
        "documentation": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }

