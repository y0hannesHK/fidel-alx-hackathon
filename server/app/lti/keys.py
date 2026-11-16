"""Fidel's own key pair for LTI 1.3.

Fidel signs its messages to a learning platform (the request for a gradebook
token, the lesson a teacher picked) with a private RSA key. The platform checks
the signature with Fidel's public key, which it reads from /lti/jwks.

The key is made the first time it is needed and saved in data/lti/ (which is
git-ignored), so it stays the same after a restart: the platform keeps trusting
Fidel. Delete the folder to make a new key; platforms then read the new public
key from /lti/jwks by themselves.
"""

import base64
import hashlib
import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from ..config import settings

KEY_FILE = "private-key.pem"
_lock = threading.Lock()
_cached: "KeyPair | None" = None


@dataclass(frozen=True)
class KeyPair:
    private_key: rsa.RSAPrivateKey
    kid: str  # key id: names the key in signed messages and in the key set

    def public_jwk(self) -> dict:
        """The public half as a JSON Web Key (never the private numbers)."""
        jwk = RSAAlgorithm.to_jwk(self.private_key.public_key(), as_dict=True)
        jwk.pop("key_ops", None)  # "use" says the same; RFC 7517 advises against sending both
        return {**jwk, "kid": self.kid, "alg": "RS256", "use": "sig"}


def _thumbprint(private_key: rsa.RSAPrivateKey) -> str:
    """RFC 7638 key thumbprint: the same key always gets the same id."""
    jwk = RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    canonical = json.dumps({"e": jwk["e"], "kty": "RSA", "n": jwk["n"]}, separators=(",", ":"), sort_keys=True)
    return base64.urlsafe_b64encode(hashlib.sha256(canonical.encode()).digest()).rstrip(b"=").decode()


def key_folder() -> Path:
    return settings.data_dir / "lti"


def _load_or_create(folder: Path) -> KeyPair:
    path = folder / KEY_FILE
    if path.is_file():
        private_key = serialization.load_pem_private_key(path.read_bytes(), password=None)
    else:
        folder.mkdir(parents=True, exist_ok=True)
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        pem = private_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                        serialization.NoEncryption())
        # Written to a temporary name first, so a crash never leaves half a key.
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(pem)
        try:
            os.chmod(temporary, 0o600)  # only the server's user can read it (ignored on Windows)
        except OSError:
            pass
        temporary.replace(path)
    return KeyPair(private_key=private_key, kid=_thumbprint(private_key))


def key_pair() -> KeyPair:
    """Fidel's key pair, made on first use and kept in data/lti/."""
    global _cached
    with _lock:
        if _cached is None:
            _cached = _load_or_create(key_folder())
        return _cached


def forget_cached_key() -> None:
    """Read the key from disk again next time (used by tests to act out a restart)."""
    global _cached
    with _lock:
        _cached = None


def jwks() -> dict:
    """Fidel's public key set, served at /lti/jwks."""
    return {"keys": [key_pair().public_jwk()]}
