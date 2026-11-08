from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.flights.routes import router


def test_flights_fail_closed_for_root_and_nested_paths() -> None:
    app = FastAPI()
    app.include_router(router)

    with TestClient(app) as client:
        root = client.get("/")
        nested = client.post("/booking/search")

    assert root.status_code == 501
    assert nested.status_code == 501
    assert root.json()["message"] == "Flight services are not implemented"
