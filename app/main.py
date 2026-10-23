from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import health, tasks
from app.core.config import get_settings

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title=get_settings().app_name,
    version="0.2.0",
    description="Task management REST API with a responsive web dashboard.",
)
app.include_router(health.router)
app.include_router(tasks.router, prefix="/api/v1")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
