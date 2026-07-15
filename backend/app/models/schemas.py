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


def _validate_percentage(v: Optional[Decimal]) -> Optional[Decimal]:
    if v is None:
        return v
    if v < 0 or v > 100:
        raise ValueError("El porcentaje debe estar entre 0 y 100")
    return v


# ─── OWNER ────────────────────────────────────────────────────────────────────

class OwnerCreate(BaseModel):
    full_name: str
    document_id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    allocated_quota_percent: Optional[Decimal] = Decimal("0")

    @field_validator("allocated_quota_percent")
    @classmethod
    def validate_allocated_quota_percent(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _validate_percentage(v)


class OwnerUpdate(BaseModel):
    full_name: Optional[str] = None
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    allocated_quota_percent: Optional[Decimal] = None

    @field_validator("allocated_quota_percent")
    @classmethod
    def validate_allocated_quota_percent(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _validate_percentage(v)


class OwnerResponse(BaseModel):
    id: UUID
    full_name: str
    document_id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    status: str
    allocated_quota_percent: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime


# ─── BUILDING ─────────────────────────────────────────────────────────────────

class BuildingCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_file_name: Optional[str] = None
    photo_content_type: Optional[str] = None
    photo_storage_path: Optional[str] = None
    logo_file_name: Optional[str] = None
    logo_content_type: Optional[str] = None
    logo_storage_path: Optional[str] = None
    signature_file_name: Optional[str] = None
    signature_content_type: Optional[str] = None
    signature_storage_path: Optional[str] = None
    seal_file_name: Optional[str] = None
    seal_content_type: Optional[str] = None
    seal_storage_path: Optional[str] = None
    regulation_file_name: Optional[str] = None
    regulation_content_type: Optional[str] = None
    regulation_storage_path: Optional[str] = None


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_file_name: Optional[str] = None
    photo_content_type: Optional[str] = None
    photo_storage_path: Optional[str] = None
    logo_file_name: Optional[str] = None
    logo_content_type: Optional[str] = None
    logo_storage_path: Optional[str] = None
    signature_file_name: Optional[str] = None
    signature_content_type: Optional[str] = None
    signature_storage_path: Optional[str] = None
    seal_file_name: Optional[str] = None
    seal_content_type: Optional[str] = None
    seal_storage_path: Optional[str] = None
    regulation_file_name: Optional[str] = None
    regulation_content_type: Optional[str] = None
    regulation_storage_path: Optional[str] = None


class BuildingResponse(BaseModel):
    id: UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_file_name: Optional[str] = None
    photo_content_type: Optional[str] = None
    photo_storage_path: Optional[str] = None
    logo_file_name: Optional[str] = None
    logo_content_type: Optional[str] = None
    logo_storage_path: Optional[str] = None
    signature_file_name: Optional[str] = None
    signature_content_type: Optional[str] = None
    signature_storage_path: Optional[str] = None
    seal_file_name: Optional[str] = None
    seal_content_type: Optional[str] = None
    seal_storage_path: Optional[str] = None
    regulation_file_name: Optional[str] = None
    regulation_content_type: Optional[str] = None
    regulation_storage_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ─── APARTMENT ────────────────────────────────────────────────────────────────

class ApartmentCreate(BaseModel):
    code: str
    floor: Optional[int] = None
    tower: Optional[str] = None
    building_id: Optional[UUID] = None


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

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El monto no puede ser negativo")
        return v


class ApartmentFeeUpdate(BaseModel):
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El monto no puede ser negativo")
        return v


class BulkFeeItem(BaseModel):
    apartment_id: UUID
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El monto no puede ser negativo")
        return v


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


# ─── OWNER PAYMENT (SPEC-008) ─────────────────────────────────────────────────

class OwnerPaymentCreate(BaseModel):
    apartment_id: UUID
    period: str
    paid_at: date
    amount: Decimal
    method: Optional[str] = None
    reference: Optional[str] = None
    fine_id: Optional[UUID] = None

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        return _validate_period(v)


class PaymentRejectRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El motivo del rechazo es obligatorio")
        return v


# ─── PAYMENT ──────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    apartment_id: UUID
    owner_id: UUID
    period: str
    paid_at: date
    amount: Decimal
    method: Optional[str] = None
    reference: Optional[str] = None
    fine_id: Optional[UUID] = None

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
    fine_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


# ─── INCOME ───────────────────────────────────────────────────────────────────

class IncomeCreate(BaseModel):
    date: date
    concept: str
    amount: Decimal
    source: Optional[str] = None
    category: Optional[str] = None
    method: Optional[str] = None
    reference: Optional[str] = None
    period: Optional[str] = None
    apartment_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: Optional[str]) -> Optional[str]:
        return _validate_period(v) if v else v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El monto no puede ser negativo")
        return v


class IncomeUpdate(BaseModel):
    status: str


class IncomeResponse(BaseModel):
    id: UUID
    date: date
    concept: str
    amount: Decimal
    source: Optional[str] = None
    category: Optional[str] = None
    method: Optional[str] = None
    reference: Optional[str] = None
    period: Optional[str] = None
    apartment_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None
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


class ExpenseCategoryStats(BaseModel):
    category: Optional[str]
    amount: Decimal
    budget: Optional[Decimal] = None
    percentage_used: Optional[Decimal] = None


class ExpenseMonthlyStatsResponse(BaseModel):
    total_spend: Decimal
    budget: Decimal
    percentage_used: Decimal
    month: str
    categories: List[ExpenseCategoryStats]


class ChartCategoryData(BaseModel):
    category: Optional[str]
    amount: Decimal


class ChartMonthData(BaseModel):
    month: str
    total: Decimal


class ExpenseChartDataResponse(BaseModel):
    by_category: List[ChartCategoryData]
    monthly_trend: List[ChartMonthData]


class MonthlyBalanceBreakdownItem(BaseModel):
    label: str
    amount: Decimal


class MonthlyBalanceVariation(BaseModel):
    income_pct: Optional[float] = None
    expense_pct: Optional[float] = None
    net_balance_pct: Optional[float] = None


class MonthlyBalanceResponse(BaseModel):
    period: str
    income_total: Decimal
    expense_total: Decimal
    net_balance: Decimal
    income_breakdown: List[MonthlyBalanceBreakdownItem]
    expense_breakdown: List[MonthlyBalanceBreakdownItem]
    previous_period_variation: MonthlyBalanceVariation


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


class PasswordRecoveryRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v or "@" not in v:
            raise ValueError("Email válido requerido")
        return v.lower()


class PasswordRecoveryResponse(BaseModel):
    message: str


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
    password: Optional[str] = None
    role_id: UUID
    owner_id: Optional[UUID] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v or "@" not in v:
            raise ValueError("Email válido requerido")
        return v.lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
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
    password_is_temp: bool = False
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


# ─── APARTMENT DIRECTORY DASHBOARD ────────────────────────────────────────────

class ApartmentStatisticsResponse(BaseModel):
    total: int
    occupied: int
    vacant: int
    maintenance: int
    occupancy_rate_percent: float
    allocated_quota_percent: float


class ApartmentDirectoryItemResponse(BaseModel):
    id: UUID
    code: str
    floor: Optional[int] = None
    tower: Optional[str] = None
    area_sqm: Optional[float] = None
    status: str
    owner_name: Optional[str] = None
    allocated_quota_percent: float
    image_url: Optional[str] = None


class ApartmentDirectoryResponse(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int
    items: List[ApartmentDirectoryItemResponse]


class OwnerUnitResponse(BaseModel):
    id: UUID
    code: str
    tower: Optional[str] = None
    floor: Optional[int] = None
    area_sqm: Optional[float] = None
    allocated_quota_percent: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    parking: Optional[str] = None
    storage: Optional[str] = None
    acquisition_date: Optional[date] = None
    use_type: Optional[str] = None



class OwnerDirectoryItemResponse(BaseModel):
    id: UUID
    full_name: str
    document_id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    units: List[OwnerUnitResponse]
    ingress_date: Optional[date] = None
    balance: Decimal
    allocated_quota_percent: Decimal = Decimal("0")
    currency: str = "USD"


class OwnerDirectoryResponse(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int
    items: List[OwnerDirectoryItemResponse]


class TransactionResponse(BaseModel):
    type: str  # PAYMENT or FINE
    period: str
    amount: Decimal
    date: date
    reference: str


class OwnerDetailResponse(BaseModel):
    id: UUID
    full_name: str
    document_id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    units: List[OwnerUnitResponse]
    ingress_date: Optional[date] = None
    balance_consolidated: Decimal
    allocated_quota_percent: Decimal = Decimal("0")
    recent_transactions: List[TransactionResponse]
    currency: str = "USD"


# ─── APARTMENT FEE STATISTICS ─────────────────────────────────────────────────

class ApartmentFeeStatsResponse(BaseModel):
    period: str
    total_emitido: Decimal
    total_recaudado: Decimal
    pendiente_cobro: Decimal
    porcentaje_recaudado: float
    unidades_deuda_vencida: int
    tendencia_emitido: Optional[float]  # None si no hay mes anterior


class PeriodSummaryItem(BaseModel):
    period: str
    label: str
    vencimiento: Optional[str]
    estado: str  # ABIERTO | VENCIDO | CERRADO
    total_emitido: Decimal
    total_recaudado: Decimal
    morosidad_pct: float


class PeriodsSummaryResponse(BaseModel):
    data: List[PeriodSummaryItem]
    total: int
    page: int
    page_size: int


class OwnerProfileResponse(BaseModel):
    id: UUID
    full_name: str
    document_id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    status: str
    birth_date: Optional[date] = None
    occupant_name: Optional[str] = None
    occupant_relation: Optional[str] = None
    occupant_phone: Optional[str] = None
    occupant_inhabitants: Optional[int] = None
    emergency_name: Optional[str] = None
    emergency_relation: Optional[str] = None
    emergency_phone: Optional[str] = None
    notifications_enabled: bool = True
    allocated_quota_percent: Decimal = Decimal("0")
    photo_file_name: Optional[str] = None
    photo_content_type: Optional[str] = None
    photo_storage_path: Optional[str] = None
    last_update_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    units: List[OwnerUnitResponse] = []


class OwnerProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    birth_date: Optional[date] = None
    occupant_name: Optional[str] = None
    occupant_relation: Optional[str] = None
    occupant_phone: Optional[str] = None
    occupant_inhabitants: Optional[int] = None
    emergency_name: Optional[str] = None
    emergency_relation: Optional[str] = None
    emergency_phone: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    allocated_quota_percent: Optional[Decimal] = None

    @field_validator("allocated_quota_percent")
    @classmethod
    def validate_allocated_quota_percent(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _validate_percentage(v)
