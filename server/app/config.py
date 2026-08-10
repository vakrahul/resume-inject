from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RUNS_DIR = DATA_DIR / "runs"
UPLOADS_DIR = DATA_DIR / "uploads"
CATALOG_PATH = Path(__file__).resolve().parent / "catalog" / "patterns.json"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    mail_service_url: str = "http://localhost:3002"
    mail_dry_run: bool = False
    mail_from: str = ""
    admin_alert_email: str = "admin@company.com"
    email_domain_whitelist: str = "company.com,internal.company.com"

    port: int = 3001
    client_origin: str = "http://localhost:5174"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def ensure_data_dirs() -> None:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
