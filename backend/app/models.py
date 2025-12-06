from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    PREPARING = "PREPARING"
    PICKED_UP = "PICKED_UP"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class OrderCreate(BaseModel):
    customer_name: str = Field(..., example="Alice")
    restaurant_name: str = Field(..., example="Pizza Palace")


class Order(BaseModel):
    id: str
    customer_name: str
    restaurant_name: str
    status: OrderStatus
    created_at: datetime
    updated_at: datetime


class OrderUpdate(BaseModel):
    status: OrderStatus


# -------- In-memory "DB" for demo -------- #

class OrderStore:
    """
    Super simple in-memory store.
    For a real system, you'd swap this out for a DB/repository layer.
    """
    def __init__(self) -> None:
        self._orders: Dict[str, Order] = {}
        self._counter = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"ord_{self._counter:04d}"

    def create(self, payload: OrderCreate) -> Order:
        now = datetime.utcnow()
        oid = self._next_id()
        order = Order(
            id=oid,
            customer_name=payload.customer_name,
            restaurant_name=payload.restaurant_name,
            status=OrderStatus.PENDING,
            created_at=now,
            updated_at=now,
        )
        self._orders[oid] = order
        return order

    def list(self) -> List[Order]:
        return list(self._orders.values())

    def get(self, order_id: str) -> Optional[Order]:
        return self._orders.get(order_id)

    def update_status(self, order_id: str, status: OrderStatus) -> Optional[Order]:
        order = self._orders.get(order_id)
        if not order:
            return None
        now = datetime.utcnow()
        updated = order.model_copy(
            update={"status": status, "updated_at": now}
        )
        self._orders[order_id] = updated
        return updated


order_store = OrderStore()
