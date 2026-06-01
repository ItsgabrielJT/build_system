from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.database import close_db, init_db
from app.config.settings import settings
from app.routes import (
    account_statement,
    admin_payment_review,
    apartment_fees,
    apartments,
    auth,
    buildings,
    delinquency,
    expenses,
    fines,
    owner_payments,
    owners,
    payments,
    reports,
    users,
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Gestión Edificios API",
    version="1.0.0",
    description="API MVP para administración financiera y operativa de edificio.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_db()


PREFIX = "/api/v1"

app.include_router(auth.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(owners.router, prefix=PREFIX)
app.include_router(buildings.router, prefix=PREFIX)
app.include_router(apartments.router, prefix=PREFIX)
app.include_router(apartment_fees.router, prefix=PREFIX)
app.include_router(payments.router, prefix=PREFIX)
app.include_router(fines.router, prefix=PREFIX)
app.include_router(expenses.router, prefix=PREFIX)
app.include_router(delinquency.router, prefix=PREFIX)
app.include_router(account_statement.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(owner_payments.router, prefix=PREFIX)
app.include_router(admin_payment_review.router, prefix=PREFIX)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
