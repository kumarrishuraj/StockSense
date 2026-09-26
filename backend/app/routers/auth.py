from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..models import User
from ..schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    ProfileUpdate,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from ..services import auth_service
from ..services.auth_service import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


def _token_response(user):
    return TokenResponse(
        access_token=auth_service.create_access_token(user),
        user=UserOut.model_validate(user),
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    if auth_service.find_user(db, data.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(
        name=data.name,
        email=data.email,
        password_hash=auth_service.hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, data.email, data.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled.")
    return _token_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(data: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.name = data.name
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not auth_service.verify_password(data.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
    auth_service.set_password(user, data.new_password)
    db.commit()
    db.refresh(user)
    # Older tokens are now rejected, so hand back a fresh one.
    return _token_response(user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    otp = auth_service.issue_password_reset_otp(db, data.email)
    # Same message whether or not the account exists, so emails can't be probed.
    return ForgotPasswordResponse(
        message="If an account exists for this email, a 6-digit verification code has been issued.",
        expires_in_minutes=config.OTP_EXPIRE_MINUTES,
        dev_mode=config.OTP_DEV_MODE,
        dev_otp=otp if config.OTP_DEV_MODE else None,
    )


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp(data: VerifyOtpRequest, db: Session = Depends(get_db)):
    reset_token = auth_service.verify_password_reset_otp(db, data.email, data.otp)
    return VerifyOtpResponse(reset_token=reset_token, expires_in_minutes=config.RESET_TOKEN_EXPIRE_MINUTES)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth_service.reset_password_with_token(db, data.reset_token, data.new_password)
    return MessageResponse(message="Password updated. You can now log in with your new password.")
