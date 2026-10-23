from fastapi.testclient import TestClient

BASE = "/api/v1/tasks"


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_read_task(client: TestClient) -> None:
    response = client.post(BASE, json={"title": "  Learn FastAPI  ", "description": "First API"})
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 1
    assert data["title"] == "Learn FastAPI"
    assert data["description"] == "First API"
    assert data["status"] == "todo"
    assert data["created_at"] and data["updated_at"]

    fetched = client.get(f"{BASE}/{data['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == data


def test_list_status_filter_and_pagination(client: TestClient) -> None:
    client.post(BASE, json={"title": "First"})
    client.post(BASE, json={"title": "Second", "status": "done"})
    client.post(BASE, json={"title": "Third", "status": "done"})

    all_tasks = client.get(BASE).json()
    assert len(all_tasks) == 3
    assert all_tasks[0]["title"] == "Third"

    done = client.get(BASE, params={"status": "done"})
    assert done.status_code == 200
    assert [task["title"] for task in done.json()] == ["Third", "Second"]

    page = client.get(BASE, params={"limit": 1, "offset": 1})
    assert page.status_code == 200
    assert [task["title"] for task in page.json()] == ["Second"]


def test_patch_then_delete_task(client: TestClient) -> None:
    created = client.post(BASE, json={"title": "Draft", "description": "Remove me"}).json()
    task_id = created["id"]
    changed = client.patch(
        f"{BASE}/{task_id}", json={"status": "in_progress", "description": None}
    )
    assert changed.status_code == 200
    assert changed.json()["title"] == "Draft"
    assert changed.json()["status"] == "in_progress"
    assert changed.json()["description"] is None

    deleted = client.delete(f"{BASE}/{task_id}")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"{BASE}/{task_id}").status_code == 404


def test_missing_task_returns_404(client: TestClient) -> None:
    response = client.get(f"{BASE}/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}
    assert client.patch(f"{BASE}/999", json={"title": "Not found"}).status_code == 404
    assert client.delete(f"{BASE}/999").status_code == 404


def test_input_validation(client: TestClient) -> None:
    assert client.post(BASE, json={"title": "   "}).status_code == 422
    assert client.post(BASE, json={"title": "x" * 121}).status_code == 422
    assert client.post(BASE, json={"title": "Valid", "status": "blocked"}).status_code == 422
    assert client.get(BASE, params={"limit": 101}).status_code == 422
    assert client.get(BASE, params={"offset": -1}).status_code == 422
    assert client.get(BASE, params={"status": "blocked"}).status_code == 422


def test_invalid_patch_is_rejected(client: TestClient) -> None:
    task_id = client.post(BASE, json={"title": "Existing"}).json()["id"]
    assert client.patch(f"{BASE}/{task_id}", json={}).status_code == 422
    assert client.patch(f"{BASE}/{task_id}", json={"title": None}).status_code == 422
    assert client.patch(f"{BASE}/{task_id}", json={"status": None}).status_code == 422
    assert client.get(f"{BASE}/{task_id}").json()["title"] == "Existing"


def test_priority_and_due_date_roundtrip(client: TestClient) -> None:
    created = client.post(BASE, json={
        "title": "  Ship dashboard  ",
        "priority": "high",
        "due_date": "2026-11-05",
        "status": "in_progress",
    })
    assert created.status_code == 201
    assert created.json()["title"] == "Ship dashboard"
    assert created.json()["priority"] == "high"
    assert created.json()["due_date"] == "2026-11-05"
    task_id = created.json()["id"]
    changed = client.patch(f"{BASE}/{task_id}", json={"priority": "low", "due_date": None})
    assert changed.status_code == 200
    assert changed.json()["priority"] == "low"
    assert changed.json()["due_date"] is None


def test_search_filter_priority_and_sort(client: TestClient) -> None:
    client.post(BASE, json={"title": "Design interface", "description": "Lovely colors", "priority": "low", "due_date": "2026-11-30"})
    client.post(BASE, json={"title": "Write API tests", "description": "Edge cases", "priority": "high", "due_date": "2026-11-01"})
    client.post(BASE, json={"title": "Write docs", "description": "For the API", "priority": "medium"})

    assert [t["title"] for t in client.get(BASE, params={"search": "API"}).json()] == ["Write docs", "Write API tests"]
    assert [t["title"] for t in client.get(BASE, params={"search": "lovely"}).json()] == ["Design interface"]
    assert [t["title"] for t in client.get(BASE, params={"priority": "high"}).json()] == ["Write API tests"]
    assert [t["title"] for t in client.get(BASE, params={"sort": "priority"}).json()] == ["Write API tests", "Write docs", "Design interface"]
    assert [t["title"] for t in client.get(BASE, params={"sort": "due"}).json()] == ["Write API tests", "Design interface", "Write docs"]
    assert [t["title"] for t in client.get(BASE, params={"sort": "oldest"}).json()] == ["Design interface", "Write API tests", "Write docs"]


def test_search_wildcards_are_literal(client: TestClient) -> None:
    client.post(BASE, json={"title": "Finish 100%"})
    client.post(BASE, json={"title": "Finish 100 percent"})
    assert [t["title"] for t in client.get(BASE, params={"search": "100%"}).json()] == ["Finish 100%"]
    assert client.get(BASE, params={"search": "_"}).json() == []


def test_stats_and_overdue(client: TestClient) -> None:
    empty = client.get(f"{BASE}/stats")
    assert empty.status_code == 200
    assert empty.json() == {"total": 0, "todo": 0, "in_progress": 0, "done": 0, "overdue": 0, "completion_rate": 0}
    client.post(BASE, json={"title": "Overdue todo", "due_date": "2020-01-01"})
    client.post(BASE, json={"title": "Progress", "status": "in_progress", "due_date": "2020-01-02"})
    client.post(BASE, json={"title": "Done", "status": "done", "due_date": "2020-01-01"})
    client.post(BASE, json={"title": "No due date"})
    stats = client.get(f"{BASE}/stats")
    assert stats.status_code == 200
    assert stats.json() == {"total": 4, "todo": 2, "in_progress": 1, "done": 1, "overdue": 2, "completion_rate": 25}


def test_extended_validation(client: TestClient) -> None:
    assert client.post(BASE, json={"title": "Task", "priority": "urgent"}).status_code == 422
    assert client.post(BASE, json={"title": "Task", "due_date": "never"}).status_code == 422
    assert client.get(BASE, params={"priority": "urgent"}).status_code == 422
    assert client.get(BASE, params={"sort": "unsorted"}).status_code == 422
    assert client.get(BASE, params={"search": "a" * 121}).status_code == 422
    task_id = client.post(BASE, json={"title": "Task"}).json()["id"]
    assert client.patch(f"{BASE}/{task_id}", json={"priority": None}).status_code == 422


def test_dashboard_and_static_assets(client: TestClient) -> None:
    page = client.get("/")
    assert page.status_code == 200
    assert "text/html" in page.headers["content-type"]
    assert "Your task board" in page.text
    for path in ("styles.css", "app.js", "favicon.svg"):
        result = client.get(f"/static/{path}")
        assert result.status_code == 200
        assert len(result.content) > 50
    assert client.get("/docs").status_code == 200
