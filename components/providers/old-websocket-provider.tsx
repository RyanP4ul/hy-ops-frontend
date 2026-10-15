"use client";

import { createContext, useContext, useEffect, useRef } from "react";

const WebSocketContext = createContext<any>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnect = useRef(true);
  const is_first_connection = useRef(true);
  const reconnect_attempt = useRef(0);
  const max_reconnect_attempts = 5;
  const reconnect_interval = 3000;

  let is_connected = false;

  const connect = () => {
    const ws = new WebSocket("ws://localhost:5173/ws");

    socketRef.current = ws;

    ws.onopen = () => {
      console.log("Connected");

      is_connected = true;
      is_first_connection.current = false;

      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (event) => {
      console.log(JSON.parse(event.data));
    };

    ws.onerror = (error) => {
      console.error(error);
    };

    ws.onclose = () => {
      console.log("Disconnected");

      is_connected = false;

      if (!shouldReconnect.current) return;

      if (reconnect_attempt.current < max_reconnect_attempts) {
        console.log(`Reconnecting in ${reconnect_interval / 1000} seconds...`);
        reconnect_attempt.current++;
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, reconnect_interval);
      } else {
        console.log("Max reconnect attempts reached. Giving up.");
      }
    };
  };

  useEffect(() => {
    connect();

    return () => {
      shouldReconnect.current = false;

      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }

      socketRef.current?.close();
    };
  }, []);

  const send = (data: unknown) => {
    const ws = socketRef.current;

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn("Socket is not connected.");
    }
  };

  return (
    <WebSocketContext.Provider
      value={{
        socket: socketRef.current,
        send,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);
