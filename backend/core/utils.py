import base64
import hashlib
import hmac
import secrets
import struct
import time
from decimal import Decimal, ROUND_DOWN


def quantize_amount(value):
    """Ensure decimal values are represented with 2 decimal places."""
    if value is None:
        return None
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_DOWN)


def generate_otp_secret(length=20):
    """Generate a base32 secret suitable for TOTP applications."""
    return base64.b32encode(secrets.token_bytes(length)).decode("utf-8").replace("=", "")


def build_totp_uri(secret, username, issuer="PFM"):
    return f"otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}"


def _hotp(secret, counter, digits=6):
    padded_secret = secret.upper() + ("=" * ((8 - len(secret) % 8) % 8))
    key = base64.b32decode(padded_secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10**digits)).zfill(digits)


def generate_totp_code(secret, timestamp=None, period=30, digits=6):
    timestamp = int(timestamp or time.time())
    counter = timestamp // period
    return _hotp(secret, counter, digits=digits)


def verify_totp_code(secret, code, window=1, timestamp=None, period=30, digits=6):
    if not secret or not code:
        return False

    timestamp = int(timestamp or time.time())
    try:
        normalized = str(int(code)).zfill(digits)
    except (TypeError, ValueError):
        return False

    current_counter = timestamp // period
    for offset in range(-window, window + 1):
        if _hotp(secret, current_counter + offset, digits=digits) == normalized:
            return True
    return False


def generate_backup_codes(count=8):
    return [f"{secrets.token_hex(2)}-{secrets.token_hex(2)}".upper() for _ in range(count)]
