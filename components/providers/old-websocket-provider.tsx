"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type WebSocketContextValue = {
  socket: WebSocket | null;
  send: (data: unknown) => void;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(true);
  const reconnectAttempt = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3_000;

  const connect = useCallback(function connectSocket() {
    const ws = new WebSocket("ws://localhost:5173/ws");
    socketRef.current = ws;
    setSocket(ws);

    ws.onopen = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onerror = () => {
      // Connection errors are surfaced through app-level status state.
    };

    ws.onclose = () => {
      if (!shouldReconnect.current) return;

      if (reconnectAttempt.current < maxReconnectAttempts) {
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(() => {
          connectSocket();
        }, reconnectInterval);
      }
    };
  }, [maxReconnectAttempts, reconnectInterval]);

  useEffect(() => {
    connect();

    return () => {
      shouldReconnect.current = false;

      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }

      socketRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    const ws = socketRef.current;

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        send,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error("useWebSocket must be used inside WebSocketProvider");
  }

  return context;
}