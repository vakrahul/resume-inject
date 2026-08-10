from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config import UPLOADS_DIR, ensure_data_dirs, get_settings
from app.routes import blue, catalog, red, runs

ensure_data_dirs()
settings = get_settings()

app = FastAPI(title="ResumeGuard AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.client_origin, "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(red.router)
app.include_router(blue.router)
app.include_router(catalog.router)
app.include_router(runs.router)


@app.get("/api/health")
def health():
    get_settings.cache_clear()
    s = get_settings()
    return {
        "ok": True,
        "product": "ResumeGuard AI",
        "backend": "python-fastapi",
        "mail": "nodemailer-sidecar",
        "mailMode": "dry-run" if s.mail_dry_run else "live",
    }


@app.get("/files/{filename}")
def serve_file(filename: str):
    safe = Path(filename).name
    path = UPLOADS_DIR / safe
    if not path.exists():
        raise HTTPException(404, "file not found")
    media = "application/pdf"
    if safe.endswith(".tex"):
        media = "application/x-tex"
    elif safe.endswith(".txt"):
        media = "text/plain"
    return FileResponse(path, media_type=media, filename=safe)


@app.exception_handler(HTTPException)
async def http_exc_handler(_req: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(Exception)
async def unhandled(_req: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})
