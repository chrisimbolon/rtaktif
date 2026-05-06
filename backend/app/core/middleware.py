"""Request logging middleware — mirrors hr-app/core/middleware.py."""
import time
import logging
from fastapi import Request

logger = logging.getLogger("rukunrt")


async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info(
        f"{request.method} {request.url.path} "
        f"→ {response.status_code} [{duration}ms]"
    )
    return response
