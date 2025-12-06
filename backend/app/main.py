# backend/app/main.py

from __future__ import annotations

import asyncio
from typing import Dict, List

from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models import (
    Order,
    OrderCreate,
    OrderUpdate,
    OrderStatus,
    order_store,
)


# -------- WebSocket connection manager -------- #

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        data = jsonable_encoder(message)
        # use a copy of the list in case we remove dead connections
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except WebSocketDisconnect:
                self.disconnect(connection)


manager = ConnectionManager()

# -------- FastAPI app -------- #

app = FastAPI(
    title="Order Notifications Demo",
    description="Minimal REST + WebSocket API for order status updates.",
    version="0.1.0",
)

# Allow Vite dev server (default 5173) to talk to backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OrderEvent(BaseModel):
    """Payload sent over WebSocket whenever an order changes."""
    type: str  # e.g., "order_created", "order_updated"
    order: Order
    

@app.get("/")
async def root():
    return {"message": "Order Notifications Demo API", "docs": "/docs", "health": "/health"}


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/orders", response_model=List[Order])
async def list_orders() -> List[Order]:
    return order_store.list()


@app.post("/orders", response_model=Order)
async def create_order(payload: OrderCreate) -> Order:
    order = order_store.create(payload)
    event = OrderEvent(type="order_created", order=order)
    await manager.broadcast(event.model_dump())
    return order


@app.patch("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, payload: OrderUpdate) -> Order:
    updated = order_store.update_status(order_id, payload.status)
    if updated is None:
        raise HTTPException(status_code=404, detail="Order not found")

    event = OrderEvent(type="order_updated", order=updated)
    await manager.broadcast(event.model_dump())
    return updated


@app.websocket("/ws/orders")
async def websocket_orders(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        snapshot = {
            "type": "snapshot",
            "orders": order_store.list(),
        }
        await websocket.send_json(jsonable_encoder(snapshot))
        # keep connection open (demo: no messages from client)
        while True:
            await asyncio.sleep(3600)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

