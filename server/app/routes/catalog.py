from fastapi import APIRouter, Query

from app.catalog import get_patterns, load_patterns

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/patterns")
def patterns(limit: int = Query(100, ge=1, le=500)):
    all_patterns = load_patterns()
    return {"total": len(all_patterns), "patterns": get_patterns(limit)}
