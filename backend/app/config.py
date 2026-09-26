"""Runtime settings, read from environment variables (and backend/.env if present)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# Placeholder used when JWT_SECRET is not configured. Fine for local demos only.
DEFAULT_JWT_SECRET = "dev-only-insecure-secret-change-me"


def _bool(name, default):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


DATABASE_URL = os.getenv(
    "DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'stocksense.db').as_posix()}"
)

JWT_SECRET = os.getenv("JWT_SECRET") or DEFAULT_JWT_SECRET
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
RESET_TOKEN_EXPIRE_MINUTES = 15
# No email/SMS provider is wired up, so in dev mode the OTP is returned in the
# forgot-password response (and printed to the server log) instead of being sent.
OTP_DEV_MODE = _bool("OTP_DEV_MODE", True)

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# Seed demo data on startup when the database has no users yet.
AUTO_SEED = _bool("AUTO_SEED", True)
