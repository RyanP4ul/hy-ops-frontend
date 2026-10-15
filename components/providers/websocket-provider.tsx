"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

import { useConnectionStore } from "@/stores/connection-store";
import { usePathname } from "next/navigation";
import { WsMessage } from "@/types/ws";
import { REQUESTS } from "@/constant/request";

type WebSocketContextType = {
  send: (data: unknown) => void;
  subscribe: (types: string | string[], handler: MessageHandler) => () => void;
};

type MessageHandler = (message: WsMessage) => void;
const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const socketRef = useRef<WebSocket | null>(null);

  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const shouldReconnect = useRef(true);

  const max_attempts = 5;

  let attempt = useRef(0);

  const { setConnected, setConnecting, setReconnecting } = useConnectionStore();

  const listenersRef = useRef(new Map<string, Set<MessageHandler>>());

  const subscribe = useCallback(
    (types: string | string[], handler: MessageHandler) => {
      const requestTypes = Array.isArray(types) ? types : [types];

      requestTypes.forEach((type) => {
        let listeners = listenersRef.current.get(type);

        if (!listeners) {
          listeners = new Set();
          listenersRef.current.set(type, listeners);
        }

        listeners.add(handler);
      });

      return () => {
        requestTypes.forEach((type) => {
          const listeners = listenersRef.current.get(type);

          listeners?.delete(handler);

          if (listeners?.size === 0) {
            listenersRef.current.delete(type);
          }
        });
      };
    },
    [],
  );

  const connect = () => {
    setConnecting(true);

    const ws = new WebSocket("ws://localhost:5173/ws");

    socketRef.current = ws;

    ws.onopen = () => {
      if (pathname.startsWith("/panel/")) {
        const splitPath = pathname.split("/panel/");
        const subPath = splitPath[1] || "";

        ws.send(JSON.stringify({ type: "CHANGE_PAGE", payload: [subPath] }));
      }

      attempt.current = 0;

      setConnected(true);
    };

    ws.onmessage = (event) => {
      const message: WsMessage = JSON.parse(event.data);
      const listeners = listenersRef.current.get(message.type);

      listeners?.forEach((handler) => {
        handler(message);
      });

      console.log(message);
    };

    ws.onerror = (error) => {
      attempt.current++;
    };

    ws.onclose = (event) => {
      console.log("Disconnected");

      attempt.current++;

      setConnected(false);

      if (event.code === 4001) {
        shouldReconnect.current = false;
        setReconnecting(false);
        return;
      }

      if (attempt.current >= max_attempts) {
        console.log("Max reconnect attempts reached. Giving up.");
        return;
      }

      if (!shouldReconnect.current) return;

      setReconnecting(true);

      reconnectTimeout.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  };

  useEffect(() => {
    connect();

    return () => {
      shouldReconnect.current = false;

      reconnectTimeout.current && clearTimeout(reconnectTimeout.current);

      socketRef.current?.close();
    };
  }, []);

  const send = (data: any) => {
    const ws = socketRef.current;

    console.log(`Sending data: ${JSON.stringify(data)}`);

    if (ws?.readyState === WebSocket.OPEN) {
      console.log(`WebSocket is open. Sending data: ${JSON.stringify(data)}`);
      ws.send(JSON.stringify(data));
    }
  };

  // GLOBAL SUBSCRIPTIONS
  useEffect(() => {
    return subscribe([REQUESTS.NOTIFICATION_ADDED], (message) => {
      switch (message.type) {
        case REQUESTS.NOTIFICATION_ADDED:
          console.log("Notification added:", message.payload);
          break;
      }
    });
  }, [subscribe]);

  return (
    <WebSocketContext.Provider value={{ send, subscribe }}>
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
