import React, { useEffect, useRef, useState } from "react";

type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED";

interface Order {
  id: string;
  customer_name: string;
  restaurant_name: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

type EventMessage =
  | { type: "snapshot"; orders: Order[] }
  | { type: "order_created"; order: Order }
  | { type: "order_updated"; order: Order };

const WS_URL = "ws://127.0.0.1:8000/ws/orders";
const API_BASE = "http://127.0.0.1:8000";

const OrdersView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // Connect WebSocket and handle events
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // optional: keep server loop alive
      ws.send("hello");
    };

    ws.onmessage = (ev) => {
      try {
        const data: EventMessage = JSON.parse(ev.data);
        if (data.type === "snapshot") {
          setOrders(data.orders);
        } else if (data.type === "order_created") {
          setOrders((prev) => [...prev, data.order]);
        } else if (data.type === "order_updated") {
          setOrders((prev) =>
            prev.map((o) => (o.id === data.order.id ? data.order : o))
          );
        }
      } catch (err) {
        console.error("Failed to parse message", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  // REST helpers
  const createOrder = async () => {
    if (!customerName || !restaurantName) return;
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName,
          restaurant_name: restaurantName,
        }),
      });
      if (!res.ok) {
        console.error("Failed to create order", await res.text());
      } else {
        setCustomerName("");
        setRestaurantName("");
      }
    } catch (err) {
      console.error("Request error", err);
    }
  };

  const advanceStatus = async (order: Order) => {
    const next = nextStatus(order.status);
    if (!next) return;
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        console.error("Failed to update order", await res.text());
      }
    } catch (err) {
      console.error("Request error", err);
    }
  };

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div
        style={{
          padding: "0.75rem 1rem",
          borderRadius: 8,
          background: connected ? "#e6ffed" : "#ffeaea",
          border: `1px solid ${connected ? "#2ecc71" : "#e74c3c"}`,
          display: "inline-block",
          marginBottom: "1rem",
        }}
      >
        WebSocket status:{" "}
        <strong>{connected ? "Connected" : "Disconnected"}</strong>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 2fr",
          gap: "1.5rem",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2>Create order</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Restaurant name"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
            />
            <button onClick={createOrder} disabled={!customerName || !restaurantName}>
              Create order
            </button>
            <p style={{ fontSize: 12, color: "#555" }}>
              New orders appear instantly in the table via WebSocket
              <br />
              (no manual refresh needed).
            </p>
          </div>
        </div>

        <div>
          <h2>Live orders</h2>
          {orders.length === 0 ? (
            <p>No orders yet – create one on the left.</p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr>
                  <th align="left">ID</th>
                  <th align="left">Customer</th>
                  <th align="left">Restaurant</th>
                  <th align="left">Status</th>
                  <th align="left">Updated</th>
                  <th align="left">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const next = nextStatus(o.status);
                  return (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.customer_name}</td>
                      <td>{o.restaurant_name}</td>
                      <td>{o.status}</td>
                      <td>{new Date(o.updated_at).toLocaleTimeString()}</td>
                      <td>
                        {next ? (
                          <button onClick={() => advanceStatus(o)}>
                            Advance → {next}
                          </button>
                        ) : (
                          <span style={{ color: "#777" }}>Done</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

function nextStatus(current: OrderStatus): OrderStatus | null {
  switch (current) {
    case "PENDING":
      return "ACCEPTED";
    case "ACCEPTED":
      return "PICKED_UP";
    case "PICKED_UP":
      return "DELIVERED";
    default:
      return null;
  }
}

export default OrdersView;
