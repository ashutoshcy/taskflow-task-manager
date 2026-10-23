"""Add priorities and due dates, preserving existing tasks.

Revision ID: 20261023_0002
Revises: 20261023_0001
"""
from alembic import op
import sqlalchemy as sa

revision = "20261023_0002"
down_revision = "20261023_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("priority", sa.String(length=10), nullable=False, server_default="medium"))
        batch.add_column(sa.Column("due_date", sa.Date(), nullable=True))
        batch.create_check_constraint("ck_tasks_priority", "priority IN ('low', 'medium', 'high')")
        batch.create_index("ix_tasks_priority", ["priority"])


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.drop_index("ix_tasks_priority")
        batch.drop_constraint("ck_tasks_priority", type_="check")
        batch.drop_column("due_date")
        batch.drop_column("priority")
