"""Password hashing, JWT access tokens and the OTP password-reset flow."""
import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..models import PasswordResetOTP, User, utcnow

logger = logging.getLogger("stocksense.auth")

bearer_scheme = HTTPBearer(auto_error=False)

# Tests lower this to keep the suite fast; 12 is bcrypt's default work factor.
BCRYPT_ROUNDS = int(os.getenv("BCRYPT_ROUNDS", "12"))


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(password, password_hash):
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:  # malformed hash or password over bcrypt's 72-byte limit
        return False


# Checked when the email is unknown, so failed logins take the same time either way.
_DUMMY_HASH = hash_password("not-a-real-password-1")


def find_user(db, email):
    return db.query(User).filter(User.email == email.lower()).one_or_none()


def authenticate(db, email, password):
    user = find_user(db, email)
    if user is None:
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def _encode(payload, minutes):
    now = datetime.now(timezone.utc)
    # Sub-second iat, so a token issued just before a password change is still revoked.
    payload = {**payload, "iat": now.timestamp(), "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def _decode(token, expected_type):
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type or "sub" not in payload:
        return None
    return payload


def create_access_token(user):
    return _encode({"sub": str(user.id), "type": "access"}, config.ACCESS_TOKEN_EXPIRE_MINUTES)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = _decode(credentials.credentials, "access")
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Please log in again.")

    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or disabled.")
    if payload.get("iat", 0) < user.password_changed_at.timestamp():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your password was changed. Please log in again.")
    return user


def set_password(user, new_password):
    user.password_hash = hash_password(new_password)
    user.password_changed_at = utcnow()


# ------------------------------------------------------------------------- OTP


def _hash_otp(otp):
    return hmac.new(config.JWT_SECRET.encode(), otp.encode(), hashlib.sha256).hexdigest()


def deliver_otp(user, otp):
    """Hand the OTP to the user.

    No email/SMS provider is configured in this build, so in development mode the
    code is logged here and returned by the API. Plug a real sender in here before
    turning OTP_DEV_MODE off.
    """
    if config.OTP_DEV_MODE:
        logger.warning(
            "[DEV OTP] Password reset code for %s: %s (valid %s min)",
            user.email, otp, config.OTP_EXPIRE_MINUTES,
        )


def issue_password_reset_otp(db, email):
    """Create a new OTP for the account. Returns the plain code, or None if no such user."""
    user = find_user(db, email)
    if user is None or not user.is_active:
        return None

    now = utcnow()
    # Only the newest code is valid.
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.user_id == user.id, PasswordResetOTP.used_at.is_(None)
    ).update({"used_at": now}, synchronize_session=False)

    otp = f"{secrets.randbelow(1_000_000):06d}"
    db.add(PasswordResetOTP(
        user_id=user.id,
        otp_hash=_hash_otp(otp),
        expires_at=now + timedelta(minutes=config.OTP_EXPIRE_MINUTES),
    ))
    db.commit()
    deliver_otp(user, otp)
    return otp


def verify_password_reset_otp(db, email, otp):
    """Check the code and return a short-lived reset token, or raise HTTP 400."""
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired verification code.")
    too_many = HTTPException(
        status.HTTP_400_BAD_REQUEST, "Too many incorrect attempts. Please request a new code."
    )

    user = find_user(db, email)
    if user is None:
        raise invalid
    record = (
        db.query(PasswordResetOTP)
        .filter(PasswordResetOTP.user_id == user.id, PasswordResetOTP.used_at.is_(None))
        .order_by(PasswordResetOTP.id.desc())
        .first()
    )
    if record is None or record.expires_at < utcnow():
        raise invalid
    if record.attempts >= config.OTP_MAX_ATTEMPTS:
        raise too_many

    if not hmac.compare_digest(record.otp_hash, _hash_otp(otp)):
        record.attempts += 1
        db.commit()
        remaining = config.OTP_MAX_ATTEMPTS - record.attempts
        if remaining <= 0:
            raise too_many
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} left.",
        )

    record.verified_at = utcnow()
    db.commit()
    return _encode(
        {"sub": str(user.id), "type": "password_reset", "otp_id": record.id},
        config.RESET_TOKEN_EXPIRE_MINUTES,
    )


def reset_password_with_token(db, reset_token, new_password):
    payload = _decode(reset_token, "password_reset")
    if payload is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset session has expired. Please start again.")

    user = db.get(User, int(payload["sub"]))
    record = db.get(PasswordResetOTP, payload.get("otp_id"))
    if (
        user is None
        or record is None
        or record.user_id != user.id
        or record.verified_at is None
        or record.used_at is not None
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This reset request is no longer valid. Please start again."
        )

    set_password(user, new_password)
    record.used_at = utcnow()
    db.commit()
