from fastapi import APIRouter, HTTPException

from app.store.runs import get_run

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("/{run_id}")
def get_run_timeline(run_id: str):
    run = get_run(run_id)
    if not run:
        raise HTTPException(404, "run not found")
    return run
