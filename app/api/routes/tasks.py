from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskPriority, TaskRead, TaskSort, TaskStats, TaskStatus, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tasks"])
DbSession = Annotated[Session, Depends(get_db)]


def get_task_or_404(task_id: int, db: Session) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: DbSession) -> Task:
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/stats", response_model=TaskStats)
def task_stats(db: DbSession) -> TaskStats:
    today = date.today()
    count = func.count(Task.id)
    total, todo, progress, done, overdue = db.execute(
        select(
            count,
            func.sum(case((Task.status == "todo", 1), else_=0)),
            func.sum(case((Task.status == "in_progress", 1), else_=0)),
            func.sum(case((Task.status == "done", 1), else_=0)),
            func.sum(case((Task.due_date < today, case((Task.status != "done", 1), else_=0)), else_=0)),
        )
    ).one()
    total, todo, progress, done, overdue = [int(value or 0) for value in (total, todo, progress, done, overdue)]
    return TaskStats(
        total=total,
        todo=todo,
        in_progress=progress,
        done=done,
        overdue=overdue,
        completion_rate=round(done / total * 100) if total else 0,
    )


@router.get("", response_model=list[TaskRead])
def list_tasks(
    db: DbSession,
    status_filter: Annotated[TaskStatus | None, Query(alias="status")] = None,
    priority: TaskPriority | None = None,
    search: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    sort: TaskSort = TaskSort.newest,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Task]:
    query = select(Task)
    if status_filter is not None:
        query = query.where(Task.status == status_filter.value)
    if priority is not None:
        query = query.where(Task.priority == priority.value)
    if search is not None:
        # Escape SQL LIKE wildcard characters in user-entered searches.
        safe = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        if safe:
            needle = f"%{safe}%"
            query = query.where(or_(Task.title.ilike(needle, escape="\\"), Task.description.ilike(needle, escape="\\")))
    if sort == TaskSort.oldest:
        query = query.order_by(Task.created_at.asc(), Task.id.asc())
    elif sort == TaskSort.due:
        query = query.order_by(Task.due_date.is_(None), Task.due_date.asc(), Task.id.desc())
    elif sort == TaskSort.priority:
        query = query.order_by(case((Task.priority == "high", 0), (Task.priority == "medium", 1), else_=2), Task.id.desc())
    else:
        query = query.order_by(Task.created_at.desc(), Task.id.desc())
    return list(db.scalars(query.limit(limit).offset(offset)).all())


@router.get("/{task_id}", response_model=TaskRead)
def read_task(task_id: int, db: DbSession) -> Task:
    return get_task_or_404(task_id, db)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, db: DbSession) -> Task:
    task = get_task_or_404(task_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: DbSession) -> Response:
    task = get_task_or_404(task_id, db)
    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
