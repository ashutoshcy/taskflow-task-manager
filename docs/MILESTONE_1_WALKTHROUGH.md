# Milestone 1 — Learn what you are building

## 1. What is an API?

An API is an interface that lets programs talk to one another. A frontend, Swagger UI, Postman, or `curl` makes an HTTP request. FastAPI reads the method and URL, validates request data, calls Python code, and returns a JSON response.

## 2. What does REST mean here?

You work with **resources** (tasks), and choose an HTTP method for an action:

- `POST /api/v1/tasks` → create a task
- `GET /api/v1/tasks` → read a list of tasks
- `GET /api/v1/tasks/1` → read task 1
- `PATCH /api/v1/tasks/1` → change some fields on task 1
- `DELETE /api/v1/tasks/1` → delete task 1

`201` means created, `200` means success with data, `204` means successful deletion with no body, `404` means unknown ID, and `422` means invalid input.

## 3. How a POST request moves through your code

1. A caller sends JSON to `/api/v1/tasks`.
2. `app/main.py` registers the router in `app/api/routes/tasks.py`.
3. `TaskCreate` in `app/schemas/task.py` checks the JSON (title required, length constraints, allowed status).
4. FastAPI uses `get_db()` from `app/db/session.py` to give the endpoint a short-lived database session.
5. The endpoint constructs a `Task` ORM object from `app/models/task.py`.
6. `db.add()`, `db.commit()`, and `db.refresh()` insert and reread the record.
7. `TaskRead` determines which fields are returned to the caller as JSON.

## 4. Why three layers?

- **Model:** `app/models/task.py` defines the SQL **table and columns**.
- **Schema:** `app/schemas/task.py` defines the **allowed request and response JSON**.
- **Router:** `app/api/routes/tasks.py` defines the **URLs and actions**.

Splitting these up makes it easier to change or test one concern at a time. Later we can add a separate service layer for more complex business logic.

## 5. Why do we need migrations?

A database schema describes the tables and their columns. Migrations are numbered changes to that schema. `alembic upgrade head` applies the initial migration that creates the `tasks` table. This is more maintainable than silently recreating tables whenever the web server starts.

## 6. Why are there two databases?

The project **uses only one database at a time**, configured by `DATABASE_URL`. SQLite is a simple file-based starting point. PostgreSQL uses a running database server and mirrors typical production infrastructure. Tests use a separate temporary database so you don't accidentally delete your own tasks.

## 7. Helpful terminal exercises

Run the server and open `/docs`. Try these in order:

1. `POST /api/v1/tasks` with `{"title":"Study SQL"}`. Observe the 201 response.
2. `GET /api/v1/tasks`. Find your new task and its generated ID.
3. `PATCH /api/v1/tasks/{id}` with `{"status":"in_progress"}`.
4. `GET /api/v1/tasks?status=in_progress` to filter your data.
5. `POST` with `{"title":""}` and observe the 422 validation error.
6. `GET /api/v1/tasks/999999` and observe the 404 error.
7. `DELETE /api/v1/tasks/{id}` and observe 204, then try to GET it again.
8. Run `python -m pytest -v` and read the tests in `tests/test_tasks.py`.

## 8. A useful small challenge

Add a `priority` field with values `low`, `medium`, and `high`:

1. Add the database column to `app/models/task.py`.
2. Add the field to request/response schemas in `app/schemas/task.py`.
3. Create and review a new Alembic migration.
4. Adjust your tests to verify the default and validation rules.

Do not expose this milestone on the public web yet: it has no logins or permission checks.
