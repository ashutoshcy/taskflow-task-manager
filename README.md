# Taskflow

A task manager for keeping work organized without fighting the interface. It has a responsive Kanban board, a compact list view, and a FastAPI backend that saves tasks to a SQL database. Everything runs locally without a frontend build step.

![Taskflow desktop screenshot](docs/screenshots/dashboard-desktop.webp)

### Screenshots

| Dark mode | Mobile layout |
| --- | --- |
| ![Taskflow dark theme](docs/screenshots/dashboard-dark.webp) | ![Taskflow mobile view](docs/screenshots/dashboard-mobile.webp) |

## What's included

- **Dashboard:** Total tasks, in-progress tasks, completed tasks, and completion rate.
- **Kanban board:** To do / In progress / Done columns; drag and drop tasks between columns.
- **Task editor:** Create, edit, delete, and mark tasks as completed.
- **Task attributes:** Title, description, status, priority, due date, creation/update timestamps.
- **Find what matters:** Search task title/description, filter priorities, sort by date or priority.
- **Views:** Responsive board view and compact list view; light and dark themes.
- **Product details:** Keyboard shortcuts (`N` to add, `/` to search, `Esc` to close), loading/error/empty states, confirmations, CSV export, and optional example tasks.
- **Backend engineering:** Pydantic validation, consistent HTTP status codes, persistent SQLAlchemy models, Alembic migrations, and Pytest coverage.
- **PostgreSQL-ready:** SQLite for one-command local development, PostgreSQL via Docker Compose.
- **No frontend build chain:** HTML, CSS, and vanilla JavaScript are served directly by FastAPI; no Node installation required to run the app.

## Tech stack

| Area | Technology |
| --- | --- |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic 2 |
| Databases | SQLite (default), PostgreSQL (optional) |
| Migrations | Alembic |
| Frontend | Semantic HTML, modern CSS, vanilla JavaScript, Fetch API |
| Tests | Pytest, FastAPI TestClient, HTTPX |
| Automation | GitHub Actions CI |

## How it works

The frontend is plain HTML, CSS and JavaScript served by FastAPI. It makes HTTP requests to `/api/v1/tasks`; FastAPI validates each request with Pydantic, then SQLAlchemy reads or updates the database. Alembic handles schema changes.

A few intentional choices:

- **Plain JavaScript, not a framework:** fewer moving parts for a project of this size, and the core browser APIs are visible in the code.
- **SQLite by default:** a new checkout is easy to run. Switching to PostgreSQL only changes the database connection and migration target.
- **Server-side filtering:** search, priorities and sorting work through the same API used by the UI, rather than maintaining a separate filtering implementation.
- **No mock data in the normal workflow:** the board starts empty. Example tasks are optional and saved through the real API.

## Get started

1. Download / clone this repository and open the project folder in VS Code.
2. Create and activate a virtual environment, then install the dependencies.
3. Copy `.env.example` to `.env`, run migrations, and start the FastAPI server.

**macOS / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

**Windows PowerShell**

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Open the following URLs in your browser:

- **Dashboard:** http://127.0.0.1:8000/
- **Interactive API docs:** http://127.0.0.1:8000/docs
- **Health endpoint:** http://127.0.0.1:8000/health

The database starts empty. Select **Try sample tasks** on the dashboard to add five editable example tasks, or select **New task** to build your own board.

> Upgrading from Milestone 1? Run `alembic upgrade head` with your existing `.env` and database. Migration `20261023_0002` adds priority and due date without deleting existing tasks. Existing tasks receive the default priority `medium`.

### Run tests

```bash
python -m pytest -v
```

The test suite creates isolated SQLite databases; it does not modify your local `tasks.db`. GitHub Actions runs tests on three Python versions and validates the JS syntax.

## API endpoints

All task endpoints are prefixed with `/api/v1/tasks`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Process health check |
| `GET` | `/api/v1/tasks/stats` | Task counts and completion rate |
| `POST` | `/api/v1/tasks` | Create task |
| `GET` | `/api/v1/tasks` | List, filter, search and sort tasks |
| `GET` | `/api/v1/tasks/{id}` | Read task details |
| `PATCH` | `/api/v1/tasks/{id}` | Update task fields |
| `DELETE` | `/api/v1/tasks/{id}` | Delete task |

Available list query parameters:

| Parameter | Values |
| --- | --- |
| `status` | `todo`, `in_progress`, `done` |
| `priority` | `low`, `medium`, `high` |
| `search` | Text in title or description; up to 120 characters |
| `sort` | `newest`, `oldest`, `due`, `priority` |
| `limit`, `offset` | Pagination, maximum 100 tasks per request |

Example request:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Ship my portfolio","description":"Prepare README and screenshots","status":"todo","priority":"high","due_date":"2026-11-10"}'
```

Example response:

```json
{
  "id": 1,
  "title": "Ship my portfolio",
  "description": "Prepare README and screenshots",
  "status": "todo",
  "priority": "high",
  "due_date": "2026-11-10",
  "created_at": "2026-10-23T13:00:00",
  "updated_at": "2026-10-23T13:00:00"
}
```

## Switch to PostgreSQL (optional)

1. Install Docker Desktop and launch it.
2. Run `docker compose up -d` in the project directory.
3. Update `.env` with:

```ini
DATABASE_URL=postgresql+psycopg://task_user:dev_password_change_me@localhost:5432/task_manager
```

4. Run `alembic upgrade head` again and restart Uvicorn.

The credentials in `docker-compose.yml` are **for local development only**. Never reuse them in production and never commit `.env` or a real database file.

## Project structure

```text
app/
  api/routes/           # Task CRUD and health endpoints
  core/                 # Configuration
  db/                   # SQLAlchemy database sessions
  models/               # SQLAlchemy database models
  schemas/              # Request and response validation
  static/               # Dashboard HTML, CSS, JS and favicon
  main.py               # FastAPI application and UI mounting
alembic/                # Versioned database migrations
tests/                  # Isolated API tests
docs/screenshots/       # Actual desktop, dark mode, and mobile UI captures
.github/workflows/      # CI checks
```

## Quality and scope

See [QA report](docs/QA_REPORT.md) for verified test coverage, UI checks, and current limitations.

**Important:** This version intentionally has **no accounts, authentication, or per-user authorization**. It is designed for a trusted local single-user environment and should **not** be exposed to the public internet for real data. Before publishing a live hosted demo, add secure login, access controls, appropriate database/secret management and production protections.

### Next enhancements

- Accounts, secure password hashing, JWT sessions, and per-user task ownership.
- User-friendly timezone handling, recurring tasks, and richer reports.
- Production deployment, monitoring, rate limiting, and optional collaboration features.

## License

MIT — see [LICENSE](LICENSE).
