"""LTI 1.3, phase 1: Fidel's key set, registering platforms, and the off switch."""

import dataclasses
import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.api import lti
from app.lti import keys
from app.main import app
from tests.conftest import STAFF

MOODLE = {
    "name": "Test Moodle",
    "issuer": "https://moodle.example.org",
    "client_id": "abc123",
    "deployment_ids": ["1"],
    "auth_login_url": "https://moodle.example.org/mod/lti/auth.php",
    "auth_token_url": "https://moodle.example.org/mod/lti/token.php",
    "key_set_url": "https://moodle.example.org/mod/lti/certs.php",
}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
        for platform in c.get("/api/v1/lti/platforms", headers=STAFF).json():
            c.delete(f"/api/v1/lti/platforms/{platform['id']}", headers=STAFF)


def test_key_set_is_public_and_checks_fidels_signatures(client):
    response = client.get("/lti/jwks")
    assert response.status_code == 200
    (key,) = response.json()["keys"]
    assert key["kty"] == "RSA" and key["alg"] == "RS256" and key["use"] == "sig" and key["kid"]
    assert not {"d", "p", "q", "dp", "dq", "qi"} & key.keys()  # never the private numbers
    assert "key_ops" not in key  # "use" only (RFC 7517 4.3)

    # A message Fidel signs can be checked with the published key, as a platform would.
    token = jwt.encode({"iss": "fidel", "exp": int(time.time()) + 60}, keys.key_pair().private_key,
                       algorithm="RS256", headers={"kid": key["kid"]})
    assert jwt.get_unverified_header(token)["kid"] == key["kid"]
    public_key = jwt.PyJWK(key).key
    assert jwt.decode(token, public_key, algorithms=["RS256"])["iss"] == "fidel"


def test_key_survives_a_restart(client):
    before = client.get("/lti/jwks").json()
    assert (keys.key_folder() / keys.KEY_FILE).is_file()
    keys.forget_cached_key()  # as after a restart: read again from data/lti/
    assert client.get("/lti/jwks").json() == before


def test_staff_register_list_and_remove_platforms(client):
    assert client.get("/api/v1/lti/platforms").status_code == 401
    assert client.post("/api/v1/lti/platforms", json=MOODLE).status_code == 401

    response = client.post("/api/v1/lti/platforms", headers=STAFF,
                           json={**MOODLE, "issuer": "https://moodle.example.org/", "deployment_ids": [" 1 ", "1", "2"]})
    assert response.status_code == 201
    created = response.json()
    assert created["issuer"] == "https://moodle.example.org"  # compared exactly with each launch's "iss"
    assert created["deployment_ids"] == ["1", "2"]
    assert [p["id"] for p in client.get("/api/v1/lti/platforms", headers=STAFF).json()] == [created["id"]]

    again = client.post("/api/v1/lti/platforms", headers=STAFF, json=MOODLE)
    assert again.status_code == 409 and "registered already" in again.json()["detail"]
    # The same platform with a second client id is a separate registration.
    assert client.post("/api/v1/lti/platforms", headers=STAFF, json={**MOODLE, "client_id": "other"}).status_code == 201

    assert client.delete(f"/api/v1/lti/platforms/{created['id']}", headers=STAFF).status_code == 204
    assert client.delete(f"/api/v1/lti/platforms/{created['id']}", headers=STAFF).status_code == 404
    assert len(client.get("/api/v1/lti/platforms", headers=STAFF).json()) == 1


@pytest.mark.parametrize("change, words", [
    ({"key_set_url": "http://moodle.example.org/mod/lti/certs.php"}, "https://"),
    ({"issuer": "moodle.example.org"}, "full address"),
    ({"issuer": "https://moodle.example.org/?x=1"}, "? part"),
    ({"deployment_ids": [" "]}, "deployment id"),
    ({"client_id": "  "}, "empty"),
])
def test_bad_platform_details_are_refused_in_words(client, change, words):
    response = client.post("/api/v1/lti/platforms", headers=STAFF, json={**MOODLE, **change})
    assert response.status_code == 400
    assert words in response.json()["detail"]


def test_http_is_allowed_for_a_test_platform_on_this_computer(client):
    local = {key: value.replace("https://moodle.example.org", "http://localhost:8080") if isinstance(value, str) else value
             for key, value in MOODLE.items()}
    assert client.post("/api/v1/lti/platforms", headers=STAFF, json=local).status_code == 201
    docker = {**local, "client_id": "docker", "key_set_url": "http://moodle:8080/mod/lti/certs.php"}
    assert client.post("/api/v1/lti/platforms", headers=STAFF, json=docker).status_code == 201


def test_tool_addresses_for_the_platform(client):
    tool = client.get("/api/v1/lti/tool", headers=STAFF).json()
    assert tool["enabled"] is True
    assert tool["addresses"]["key_set_url"].endswith("/lti/jwks")
    assert tool["addresses"]["login_url"].endswith("/lti/login")
    assert tool["addresses"]["redirect_urls"] == [tool["addresses"]["tool_url"], tool["addresses"]["deep_link_url"]]
    assert client.get("/api/v1/lti/tool").status_code == 401


def test_switched_off_means_not_found(client, monkeypatch):
    monkeypatch.setattr(lti, "settings", dataclasses.replace(lti.settings, lti_enabled=False))
    for path in ("/lti/jwks", "/api/v1/lti/platforms"):
        response = client.get(path, headers=STAFF)
        assert response.status_code == 404, path
        assert "FIDEL_LTI_ENABLED" in response.json()["detail"]
    assert client.post("/api/v1/lti/platforms", headers=STAFF, json=MOODLE).status_code == 404
    # Studio can still ask whether it is on, to explain how to switch it on.
    assert client.get("/api/v1/lti/tool", headers=STAFF).json()["enabled"] is False
