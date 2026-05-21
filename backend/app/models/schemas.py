from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator

_PERIOD_RE = re.compile(r"^\d{4}-\d{2}$")


def _validate_period(v: str) -> str:
    if not _PERIOD_RE.match(v):
        raise ValueError("Período debe tener formato YYYY-MM")
    return v


# ─── OWNER ────────────────────────────────────────────────────────────────────

class OwnerCreate(BaseModel):
    full_name: str
    document_id: str
    phone: Optional[str] = None
    email: Optional[str] = None


class OwnerUpdate(BaseModel):
    full_name: Optional[str] = None
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None


class OwnerResponse(BaseModel):
    id: UUID
    full_name: str
    document_id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


# ─── BUILDING ─────────────────────────────────────────────────────────────────

class BuildingCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class BuildingResponse(BaseModel):
    id: UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ─── APARTMENT ────────────────────────────────────────────────────────────────

class ApartmentCreate(BaseModel):
    code: str
    floor: Optional[int] = None
    tower: Optional[str] = None
    building_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None


class ApartmentUpdate(BaseModel):
    code: Optional[str] = None
    floor: Optional[int] = None
    tower: Optional[str] = None
    status: Optional[str] = None


class ApartmentResponse(BaseModel):
    id: UUID
    code: str
    floor: Optional[int] = None
    tower: Optional[str] = None
    status: str
    building_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OwnerAssign(BaseModel):
    is_primary: Optional[bool] = True


# ─── APARTMENT FEES ───────────────────────────────────────────────────────────

class ApartmentFeeCreate(BaseModel):
    apartment_id: UUID
    period: str
    amount: Decimal

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        return _validate_period(v)


class BulkFeeItem(BaseModel):
    apartment_id: UUID
    amount: Decimal


class BulkFeeCreate(BaseModel):
    period: str
    fees: List[BulkFeeItem]

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        return _validate_period(v)


class BulkFeeResponse(BaseModel):
    created: int
    updated: int


class ApartmentFeeResponse(BaseModel):
    id: UUID
    apartment_id: UUID
    period: str
    amount: Decimal
    created_at: datetime


# ─── PAYMENT ──────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    apartment_id: UUID
    owner_id: UUID
    period: str
    paid_at: date
    amount: Decimal
    method: Optional[str] = None
    reference: Optional[str] = None

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        return _validate_period(v)


class PaymentUpdate(BaseModel):
    status: str


class PaymentResponse(BaseModel):
    id: UUID
    apartment_id: UUID
    owner_id: UUID
    period: str
    paid_at: date
    amount: Decimal
    method: Optional[str] = None
    reference: Optional[str] = None
    status: str
    apartment_code: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ─── FINE ─────────────────────────────────────────────────────────────────────

class FineCreate(BaseModel):
    apartment_id: UUID
    owner_id: UUID
    period: str
    issued_at: date
    reason: Optional[str] = None
    amount: Decimal

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        return _validate_period(v)


class FineUpdate(BaseModel):
    status: str


class FineResponse(BaseModel):
    id: UUID
    apartment_id: UUID
    owner_id: UUID
    period: str
    issued_at: date
    reason: Optional[str] = None
    amount: Decimal
    status: str
    apartment_code: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ─── EXPENSE ──────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    date: date
    provider: Optional[str] = None
    category: Optional[str] = None
    concept: str
    amount: Decimal


class ExpenseResponse(BaseModel):
    id: UUID
    date: date
    provider: Optional[str] = None
    category: Optional[str] = None
    concept: str
    amount: Decimal
    status: str
    created_at: datetime


class ExpenseListResponse(BaseModel):
    data: List[ExpenseResponse]
    total: Decimal


# ─── DELINQUENCY ──────────────────────────────────────────────────────────────

class PeriodBalance(BaseModel):
    period: str
    esperado: float
    multas: float
    pagado: float
    saldo: float
    status: str


class ApartmentInDelinquency(BaseModel):
    id: UUID
    code: str
    floor: Optional[int] = None


class ApartmentDelinquencyDetail(BaseModel):
    apartment: ApartmentInDelinquency
    periods: List[PeriodBalance]


class OwnerDelinquencyItem(BaseModel):
    id: UUID
    owner_id: UUID
    owner_name: str
    email: Optional[str] = None
    document_id: str
    deuda_total: float
    periodos_vencidos: int
    departamentos: List[str]
    status: str


class OwnerDelinquencyDetail(BaseModel):
    owner_id: UUID
    full_name: str
    email: Optional[str] = None
    apartments: List[ApartmentDelinquencyDetail]


# ─── ACCOUNT STATEMENT ────────────────────────────────────────────────────────

class AccountStatementRow(BaseModel):
    period: str
    apartment_id: UUID
    apartment_code: str
    esperado: float
    multas: float
    pagado: float
    saldo: float
    status: str


# ─── AUTHENTICATION ───────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenPayload(BaseModel):
    sub: str  # user_id
    email: str
    role: str
    exp: int


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"


class RoleResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None


class PermissionResponse(BaseModel):
    id: UUID
    name: str
    resource: Optional[str] = None
    action: Optional[str] = None
    description: Optional[str] = None


# ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    role_id: UUID

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v or "@" not in v:
            raise ValueError("Email válido requerido")
        return v.lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Contraseña debe tener al menos 8 caracteres")
        if not any(c.isupper() for c in v):
            raise ValueError("Contraseña debe contener mayúscula")
        if not any(c.islower() for c in v):
            raise ValueError("Contraseña debe contener minúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("Contraseña debe contener número")
        return v


class UserUpdate(BaseModel):
    role_id: Optional[UUID] = None
    status: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Contraseña debe tener al menos 8 caracteres")
        if not any(c.isupper() for c in v):
            raise ValueError("Contraseña debe contener mayúscula")
        if not any(c.islower() for c in v):
            raise ValueError("Contraseña debe contener minúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("Contraseña debe contener número")
        return v


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: RoleResponse
    status: str
    created_at: datetime
    updated_at: datetime


# ─── BUILDING ────────────────────────────────────────────────────────────────

class BuildingCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class BuildingResponse(BaseModel):
    id: UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime
    updated_at: datetime
