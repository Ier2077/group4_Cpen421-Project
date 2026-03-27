"""
WebSocket connection manager.
Clients subscribe to a room keyed by incident_id or vehicle_id.
"""
import asyncio
import json
from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # incident_id -> set of WebSocket
        self._incident_subs: dict[str, set[WebSocket]] = defaultdict(set)
        # vehicle_id -> set of WebSocket
        self._vehicle_subs: dict[str, set[WebSocket]] = defaultdict(set)

    async def subscribe_incident(self, incident_id: str, ws: WebSocket):
        await ws.accept()
        self._incident_subs[incident_id].add(ws)

    async def subscribe_vehicle(self, vehicle_id: str, ws: WebSocket):
        await ws.accept()
        self._vehicle_subs[vehicle_id].add(ws)

    def remove(self, ws: WebSocket, incident_id: str | None = None, vehicle_id: str | None = None):
        if incident_id and ws in self._incident_subs[incident_id]:
            self._incident_subs[incident_id].discard(ws)
        if vehicle_id and ws in self._vehicle_subs[vehicle_id]:
            self._vehicle_subs[vehicle_id].discard(ws)

    async def broadcast_to_incident(self, incident_id: str, data: dict):
        dead = set()
        for ws in self._incident_subs.get(incident_id, set()):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.add(ws)
        self._incident_subs[incident_id] -= dead

    async def broadcast_to_vehicle(self, vehicle_id: str, data: dict):
        dead = set()
        for ws in self._vehicle_subs.get(vehicle_id, set()):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.add(ws)
        self._vehicle_subs[vehicle_id] -= dead


ws_manager = ConnectionManager()