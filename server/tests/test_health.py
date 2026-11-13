from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_docs_are_available():
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    assert "/health" in response.json()["paths"]


def test_home_redirects_to_demo_page():
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/demo/savanna-mock/"
