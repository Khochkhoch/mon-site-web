from app import app


def test_health_repond_200():
    client = app.test_client()
    reponse = client.get("/health")
    assert reponse.status_code == 200
    assert reponse.get_json() == {"status": "ok"}


def test_page_accueil_moodtracker():
    client = app.test_client()
    reponse = client.get("/")
    assert reponse.status_code == 200
    assert b"MoodTracker" in reponse.data


def test_url_inconnue_repond_404():
    client = app.test_client()
    reponse = client.get("/nimporte-quoi")
    assert reponse.status_code == 404
