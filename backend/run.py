"""Gateway entrypoint. Sets the Windows event loop policy *before* uvicorn's
CLI would call asyncio.run() -- psycopg's async mode requires the selector
loop, but Windows' asyncio default is ProactorEventLoop, and setting the
policy from inside app/main.py runs too late (uvicorn's CLI already created
the loop via asyncio.run() before it imports the app module). Doing it here,
before uvicorn.run() is even called, is the only point that's early enough.
"""
import sys

if sys.platform == "win32":
    import asyncio

    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

from app.core.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("app.main:app", host=settings.gateway_host, port=settings.gateway_port)
