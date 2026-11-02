let socket: WebSocket | null = null;

const isDebugMode = () => process.env.NODE_ENV !== "production";

const debugLog = (...args: unknown[]) => {
  if (isDebugMode()) {
    console.debug("[websocket]", ...args);
  }
};

const errorLog = (...args: unknown[]) => {
  if (isDebugMode()) {
    console.error("[websocket]", ...args);
  }
};

function getSocketUrl() {
  if (typeof window === "undefined") {
    return "ws://localhost/ws";
  }

  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) {
    return configured;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname;
  const port =
    window.location.port &&
    window.location.port !== "80" &&
    window.location.port !== "443"
      ? `:${window.location.port}`
      : "";
  return `${protocol}://${host}${port}/ws`;
}

export function connectWebSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return socket;
  }

  socket = new WebSocket(getSocketUrl());

  socket.onopen = () => {
    debugLog("Connected");
  };

  socket.onclose = () => {
    debugLog("Disconnected");
  };

  socket.onerror = (err) => {
    errorLog("connection error", err);
  };

  return socket;
}
