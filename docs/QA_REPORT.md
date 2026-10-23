# Taskflow — Quality assurance notes

## Backend checks

- CRUD operations: create, read, update, delete.
- Correct error behavior for missing tasks and invalid input.
- Priority and due date validation plus storage round trips.
- Filtering by status or priority; text search and wildcard escaping.
- Sorting by priority, oldest, newest, and due date.
- Aggregate statistics (including overdue tasks and completion rate).
- Dashboard HTML and static assets.
- SQLite migrations: initial create and follow-up schema migration, plus a manual upgrade check confirming an existing task was preserved with default priority.

Run locally with `python -m pytest -q` and `alembic upgrade head`.

## Browser UI checks

Checked in headless Chromium at 1512 px and 390 px viewport widths:

- Empty state and adding example tasks.
- Creating a task with description, priority, due date and status.
- Editing task title and deleting with confirmation.
- Search, priority filter, board/list toggle and completed view.
- Theme toggle, mobile menu, opening and closing task editor.
- No JavaScript page errors observed in these interactions; no horizontal overflow at mobile width.

Note: The execution environment blocked direct browser HTTP navigation. UI interactions were exercised against the real local FastAPI API through a browser-to-Python transport bridge. Screenshots capture the actual UI HTML, CSS, and JavaScript in Chromium.

## Known limitations

- This is a single-user local milestone: no login/authorization. Do not host publicly as-is.
- PostgreSQL is supported by SQLAlchemy/compose settings, but only SQLite migrations and integration tests have been exercised in this environment.
- CSV export is designed for ordinary task text and escapes spreadsheet formulas, but not all spreadsheet engines or formats have been tested.
- Live deployments, performance/load testing, and screen reader auditing were not performed.
- Fonts may vary when offline because the UI has a system-font fallback.
