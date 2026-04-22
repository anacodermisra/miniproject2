"""MindPulse Backend — WebSocket Manager."""

from __future__ import annotations
import asyncio
from typing import List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Map user_id to list of active websockets
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(ws)

    def disconnect(self, ws: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if ws in self.active_connections[user_id]:
                self.active_connections[user_id].remove(ws)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for ws in list(self.active_connections[user_id]):
                try:
                    await asyncio.wait_for(ws.send_json(message), timeout=2.0)
                except Exception:
                    self.disconnect(ws, user_id)

    async def broadcast(self, message: dict):
        """Send to all users (used for system-wide notices)."""
        for user_id in list(self.active_connections.keys()):
            for ws in list(self.active_connections[user_id]):
                try:
                    await asyncio.wait_for(ws.send_json(message), timeout=2.0)
                except Exception:
                    self.disconnect(ws, user_id)

    @property
    def count(self) -> int:
        return sum(len(conns) for conns in self.active_connections.values())


manager = ConnectionManager()
