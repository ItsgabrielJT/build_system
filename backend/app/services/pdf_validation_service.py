from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from typing import Any


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _secret() -> bytes:
    try:
        from app.config.settings import settings

        value = settings.jwt_secret
    except Exception:
        value = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
    return value.encode("utf-8")


def _sign(payload: str) -> str:
    digest = hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest()
    return _b64url_encode(digest)


def create_pdf_validation_token(
    *,
    document_id: str,
    file_name: str,
    generated_by: str,
    generated_role: str,
    building_name: str,
    building_id: str | None = None,
    generated_at: datetime | None = None,
) -> str:
    issued_at = generated_at or datetime.now(timezone.utc)
    payload = {
        "document_id": document_id,
        "file_name": file_name,
        "generated_by": generated_by,
        "generated_role": generated_role,
        "building_name": building_name,
        "building_id": building_id,
        "generated_at": issued_at.isoformat(),
    }
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    encoded_payload = _b64url_encode(payload_json.encode("utf-8"))
    return f"{encoded_payload}.{_sign(encoded_payload)}"


def validate_pdf_validation_token(token: str) -> dict[str, Any]:
    try:
        encoded_payload, signature = token.split(".", 1)
    except ValueError:
        return {"valid": False}

    expected_signature = _sign(encoded_payload)
    if not hmac.compare_digest(signature, expected_signature):
        return {"valid": False}

    try:
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return {"valid": False}

    return {
        "valid": True,
        "document_id": payload.get("document_id") or "",
        "file_name": payload.get("file_name") or "",
        "generated_by": payload.get("generated_by") or "",
        "generated_role": payload.get("generated_role") or "",
        "building_name": payload.get("building_name") or "",
        "building_id": payload.get("building_id") or "",
        "generated_at": payload.get("generated_at") or "",
    }
