from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file so it works regardless of CWD
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/edificios"
    dev_mode: bool = True
    firebase_project_id: str = ""
    cors_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:5175"
    )
    due_day: int = 5
    budget_monthly: float = 15000.0
    budget_maintenance: float = 3500.0
    
    # Mailjet Configuration
    mailjet_api_key: str = ""
    mailjet_api_secret: str = ""
    mailjet_from_email: str = "no-reply@edificios.com"
    mailjet_from_name: str = "Build System"
    admin_notification_email: str = "admin@edificios.com"
    app_url: str = "http://localhost:5173"

    # JWT Configuration
    jwt_secret: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # Payment proof uploads (SPEC-008)
    allowed_proof_types: str = "image/jpeg,image/png,application/pdf"
    max_proof_size_mb: int = 5
    upload_dir: str = "/tmp/edificios_uploads"

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE), env_file_encoding="utf-8"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()

from decimal import Decimal  # noqa: E402

BUDGET_MONTHLY = Decimal(str(settings.budget_monthly))
BUDGET_MAINTENANCE = Decimal(str(settings.budget_maintenance))
