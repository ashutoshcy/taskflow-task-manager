from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    # A simple process-health check, not a database readiness probe.
    return {"status": "ok"}
