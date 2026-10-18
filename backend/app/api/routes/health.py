from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.database import ping

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness and database connectivity")
async def health(request: Request) -> JSONResponse:
    client = getattr(request.app.state, "mongo_client", None)
    db_up = client is not None and await ping(client)
    return JSONResponse(
        status_code=200 if db_up else 503,
        content={"status": "ok" if db_up else "degraded", "database": "up" if db_up else "down"},
    )
