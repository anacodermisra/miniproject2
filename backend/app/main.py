"""MindPulse Backend — FastAPI Application."""

from __future__ import annotations
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import APP_NAME, VERSION, DESCRIPTION
from app.api.routes import router
from app.api.auth_routes import router as auth_router
from app.services.inference import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("mindpulse")

log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.getLogger("mindpulse").setLevel(getattr(logging, log_level, logging.INFO))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MindPulse backend v%s", VERSION)
    engine.load()
    if engine.is_ready:
        logger.info("Inference engine ready")
    else:
        logger.warning("Inference engine failed to load — running in fallback mode")
    yield
    logger.info("Shutting down MindPulse backend")


app = FastAPI(
    title=APP_NAME, version=VERSION, description=DESCRIPTION, lifespan=lifespan
)

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development ease
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"app": APP_NAME, "version": VERSION, "status": "running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
