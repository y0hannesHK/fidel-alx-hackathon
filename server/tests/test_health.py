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
    assert response.headers["location"] == "/demo/"


def test_text_is_compressed_but_media_is_not():
    # JSON (and scripts, pages) are compressed for slow connections.
    response = client.get("/api/openapi.json", headers={"Accept-Encoding": "gzip"})
    assert response.headers.get("content-encoding") == "gzip"
    # Media is never compressed (it is already, and seeking needs byte ranges).
    from app.main import CompressText
    assert "/files/lessons/abc/video.mp4".endswith(CompressText.SKIP)


def test_other_sites_may_send_learner_posts_but_never_staff_requests():
    """A player embedded on Savanna (another address) can send a caption report
    (JSON POST), but a page on another site can never send the staff token."""
    learner = client.options("/api/v1/lessons/abc123abc123/caption-reports", headers={
        "Origin": "https://savanna.example", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"})
    assert learner.status_code == 200
    assert "POST" in learner.headers["access-control-allow-methods"]

    staff = client.options("/api/v1/lessons", headers={
        "Origin": "https://savanna.example", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization"})
    assert staff.status_code == 400  # the browser refuses to send the request
