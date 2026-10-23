# Learn how the Taskflow dashboard works

The frontend deliberately uses **plain HTML, CSS and JavaScript**, so you can learn the full request cycle without learning React or installing Node first.

## 1. Three important files

- `app/static/index.html`: Semantic page structure (sidebar, statistics, Kanban board, form drawer, confirmation dialog).
- `app/static/styles.css`: All visual design, responsive breakpoints, light/dark themes, card and drawer styles.
- `app/static/app.js`: The browser logic (API calls, rendering, filtering, keyboard shortcuts, drag/drop).

FastAPI returns `index.html` when you open `/`, while serving the stylesheet and JavaScript from `/static/`.

## 2. What happens when you create a task?

1. Click **New task** or press **N**. `openDrawer()` fills the editor with sensible defaults and focuses the task name.
2. Enter the fields and submit the form. `submitTask()` validates the title and creates the JSON object.
3. `api()` sends a `POST /api/v1/tasks` request. FastAPI validates it with Pydantic, then SQLAlchemy inserts the task into the database.
4. After success, JavaScript refreshes the task list and statistics (`loadTasks()` and `loadStats()`).
5. `renderTasks()` redraws the correct column and a toast confirms success.

The exact same API is used by Swagger UI, so it is not a pretend dashboard storing data only in the browser.

## 3. Understand and customize the Kanban view

- `state.tasks`: Tasks received from the backend.
- `columnHTML(status, title, tasks)`: HTML for one column.
- `cardHTML(task)`: HTML for a task card. The `escapeHTML()` helper protects user-entered strings before inserting them into HTML.
- `changeStatus(id, status)`: Updates the database via `PATCH` whenever you use the status dropdown or drag a task to another column.
- `setView('list')`: Toggles list layout without changing the underlying data.

## 4. Customize the design

Start with the `:root` CSS variables in `styles.css`:

```css
:root {
  --violet: #6e5ce8;
  --canvas: #f7f8fc;
  --panel: #fff;
  --sidebar: #18192d;
}
```

Try changing `--violet` to another accent color. Reload your browser; no rebuild is needed.

Three mobile breakpoints reorganize the layout as the viewport narrows. Use your browser's responsive device tools to inspect them.

## 5. Useful experiments

- Add a task and confirm it is still available after restarting the server.
- Try creating a task with a blank name: both frontend and FastAPI reject it.
- Change its status with the dropdown, then try dragging it to another column.
- Search for a word in the task description.
- Switch to dark theme and reload to see the saved preference.
- Open `/docs` and create a task through Swagger, then refresh the dashboard.

## 6. What this frontend is not

It does not have accounts or authorization. It is a local educational/portfolio milestone, not a secure public multi-user SaaS app. The appropriate next step is JWT authentication, per-user task ownership, and production deployment safeguards.
