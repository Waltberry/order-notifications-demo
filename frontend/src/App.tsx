import React from "react";
import OrdersView from "./components/OrdersView";

const App: React.FC = () => {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem" }}>
      <h1>Order Notifications Demo</h1>
      <p style={{ maxWidth: 600 }}>
        Minimal example of a <strong>WebSocket</strong>-driven UI for{" "}
        <em>order status updates</em>. The backend is a FastAPI server that
        broadcasts events whenever an order is created or its status changes.
      </p>
      <OrdersView />
    </div>
  );
};

export default App;
