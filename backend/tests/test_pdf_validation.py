"""Tests for PDF validation token create / validate round-trip.

Covers:
  - New tilde (~) separator in generated tokens
  - Backwards compatibility with legacy dot (.) separator
  - Invalid / tampered token rejection
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

# We set JWT_SECRET before importing the service so _secret() uses a
# deterministic value regardless of app.config availability.
import os

os.environ.setdefault("JWT_SECRET", "test-secret-for-pdf-validation")

from app.services.pdf_validation_service import (  # noqa: E402
    _b64url_encode,
    _sign,
    create_pdf_validation_token,
    validate_pdf_validation_token,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
_SAMPLE_ARGS = dict(
    document_id="doc-001",
    file_name="reporte.pdf",
    generated_by="admin@test.com",
    generated_role="Administrador",
    building_name="Torre Norte",
    building_id="b-123",
    generated_at=datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc),
)


def _make_legacy_dot_token(**overrides) -> str:
    """Build a token using the old dot separator so we can test compat."""
    from app.services.pdf_validation_service import _b64url_encode, _sign

    args = {**_SAMPLE_ARGS, **overrides}
    payload = {
        "document_id": args["document_id"],
        "file_name": args["file_name"],
        "generated_by": args["generated_by"],
        "generated_role": args["generated_role"],
        "building_name": args["building_name"],
        "building_id": args["building_id"],
        "generated_at": args["generated_at"].isoformat(),
    }
    payload_json = json.dumps(
        payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    encoded = _b64url_encode(payload_json.encode("utf-8"))
    return f"{encoded}.{_sign(encoded)}"


# ---------------------------------------------------------------------------
# Tests — new format
# ---------------------------------------------------------------------------


class TestNewTildeFormat:
    def test_token_uses_tilde_separator(self):
        token = create_pdf_validation_token(**_SAMPLE_ARGS)
        assert "~" in token, "Token should use tilde as separator"
        assert token.count("~") == 1, "Exactly one tilde expected"

    def test_token_has_no_dot_separator(self):
        token = create_pdf_validation_token(**_SAMPLE_ARGS)
        # Base64url may contain padding chars but never '.' by spec.
        # Ensure the old dot separator is gone.
        assert "." not in token, "Token should not contain a dot separator"

    def test_round_trip(self):
        token = create_pdf_validation_token(**_SAMPLE_ARGS)
        result = validate_pdf_validation_token(token)
        assert result["valid"] is True
        assert result["document_id"] == "doc-001"
        assert result["file_name"] == "reporte.pdf"
        assert result["generated_by"] == "admin@test.com"
        assert result["generated_role"] == "Administrador"
        assert result["building_name"] == "Torre Norte"
        assert result["building_id"] == "b-123"
        assert "2025-06-15" in result["generated_at"]


# ---------------------------------------------------------------------------
# Tests — backwards compatibility (legacy dot tokens)
# ---------------------------------------------------------------------------


class TestLegacyDotCompat:
    def test_legacy_dot_token_validates(self):
        legacy = _make_legacy_dot_token()
        result = validate_pdf_validation_token(legacy)
        assert result["valid"] is True
        assert result["document_id"] == "doc-001"

    def test_legacy_dot_full_payload(self):
        legacy = _make_legacy_dot_token()
        result = validate_pdf_validation_token(legacy)
        assert result["building_name"] == "Torre Norte"
        assert result["generated_role"] == "Administrador"


# ---------------------------------------------------------------------------
# Tests — invalid tokens
# ---------------------------------------------------------------------------


class TestInvalidTokens:
    def test_empty_string(self):
        assert validate_pdf_validation_token("")["valid"] is False

    def test_no_separator(self):
        assert validate_pdf_validation_token("abcdef123456")["valid"] is False

    def test_tampered_payload(self):
        token = create_pdf_validation_token(**_SAMPLE_ARGS)
        # Flip the first character of the payload
        tampered = ("X" if token[0] != "X" else "Y") + token[1:]
        assert validate_pdf_validation_token(tampered)["valid"] is False

    def test_tampered_signature(self):
        token = create_pdf_validation_token(**_SAMPLE_ARGS)
        # Replace last char of signature
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        assert validate_pdf_validation_token(tampered)["valid"] is False

    def test_only_separator(self):
        assert validate_pdf_validation_token("~")["valid"] is False
        assert validate_pdf_validation_token(".")["valid"] is False

    def test_random_garbage(self):
        assert validate_pdf_validation_token("not~a~real~token")["valid"] is False
