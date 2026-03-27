"""
API Gateway – lightweight reverse proxy that routes requests to backend services.
Replaces Nginx for Render deployment. Frontend talks to ONE URL.
"""
import logging
import sys
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Persistent HTTP client – reuses connections across requests
http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
    logger.info("Gateway started")
    yield
    await http_client.aclose()
    logger.info("Gateway shut down")


app = FastAPI(
    title="ERP API Gateway",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────
origins = (
    ["*"]
    if settings.ALLOWED_ORIGINS == "*"
    else [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Route map ────────────────────────────────────────────
ROUTE_MAP = {
    "/auth":       settings.AUTH_SERVICE_URL,
    "/incidents":  settings.INCIDENT_SERVICE_URL,
    "/vehicles":   settings.DISPATCH_SERVICE_URL,
    "/analytics":  settings.ANALYTICS_SERVICE_URL,
}


def _resolve_upstream(path: str) -> tuple[str, str] | None:
    """Match request path to an upstream service URL."""
    for prefix, upstream in ROUTE_MAP.items():
        if path == prefix or path.startswith(prefix + "/"):
            return upstream, path
    return None


# ── Health check ─────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}


# ── HTTP proxy ───────────────────────────────────────────
@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(request: Request, path: str):
    full_path = f"/{path}"
    resolved = _resolve_upstream(full_path)

    if not resolved:
        return Response(
            content='{"detail":"Route not found"}',
            status_code=404,
            media_type="application/json",
        )

    upstream_url, matched_path = resolved

    # Build the target URL (keep the full path including the prefix)
    target = f"{upstream_url}{matched_path}"

    # Forward query string
    if request.url.query:
        target += f"?{request.url.query}"

    # Forward headers (drop host and accept-encoding so upstream sends plain text)
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("accept-encoding", None)

    body = await request.body()

    try:
        upstream_resp = await http_client.request(
            method=request.method,
            url=target,
            headers=headers,
            content=body,
        )
    except httpx.ConnectError:
        return Response(
            content='{"detail":"Upstream service unavailable"}',
            status_code=502,
            media_type="application/json",
        )
    except httpx.TimeoutException:
        return Response(
            content='{"detail":"Upstream service timeout"}',
            status_code=504,
            media_type="application/json",
        )

    # Forward response headers (skip hop-by-hop)
    skip_headers = {"transfer-encoding", "connection", "content-encoding", "content-length"}
    resp_headers = {
        k: v
        for k, v in upstream_resp.headers.items()
        if k.lower() not in skip_headers
    }

    return Response(
        content=upstream_resp.content,
        status_code=upstream_resp.status_code,
        headers=resp_headers,
        media_type=upstream_resp.headers.get("content-type"),
    )


# ── WebSocket proxy ──────────────────────────────────────
@app.websocket("/vehicles/ws/{ws_type}/{entity_id}")
async def ws_proxy(websocket: WebSocket, ws_type: str, entity_id: str):
    """
    Proxies WebSocket connections to the dispatch service.
    Supports:
      /vehicles/ws/incident/{incident_id}
      /vehicles/ws/vehicle/{vehicle_id}
    """
    import websockets

    await websocket.accept()

    # Build upstream WS URL
    dispatch_ws = settings.DISPATCH_SERVICE_URL.replace("http://", "ws://").replace("https://", "wss://")
    upstream_url = f"{dispatch_ws}/vehicles/ws/{ws_type}/{entity_id}"

    try:
        async with websockets.connect(upstream_url) as upstream_ws:
            import asyncio

            async def client_to_upstream():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await upstream_ws.send(data)
                except WebSocketDisconnect:
                    await upstream_ws.close()

            async def upstream_to_client():
                try:
                    async for message in upstream_ws:
                        await websocket.send_text(message)
                except Exception:
                    pass

            await asyncio.gather(client_to_upstream(), upstream_to_client())

    except Exception as e:
        logger.error(f"WebSocket proxy error: {e}")
        try:
            await websocket.close(code=1011, reason="Upstream unavailable")
        except Exception:
            pass