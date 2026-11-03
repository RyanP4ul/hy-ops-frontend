"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

import { request, refreshAccessToken } from "@/components/http";
import { useAuthStore } from "@/stores/auth-store";
import { useConnectionStore } from "@/stores/connection-store";
import { usePathname } from "next/navigation";
import type { WsMessage } from "@/types/ws";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { affectedQueryRoots, createEventDeduplicator, resourceQueryRoots } from "@/lib/realtime";

type WebSocketContextType = {
  send: (data: unknown) => void;
  subscribe: (types: string | string[], handler: MessageHandler) => () => void;
  reconnect: () => void;
};

type MessageHandler = (message: WsMessage) => void;
const WebSocketContext = createContext<WebSocketContextType | null>(null);
const wsMessageSchema = z.object({
  type: z.string(),
  payload: z.unknown().optional(),
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const pathnameRef = useRef(pathname);
  const reconnectRef = useRef<() => void>(() => {});
  const listenersRef = useRef(new Map<string, Set<MessageHandler>>());
  const setConnected = useConnectionStore((state) => state.setConnected);
  const setConnecting = useConnectionStore((state) => state.setConnecting);
  const setReconnecting = useConnectionStore((state) => state.setReconnecting);

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

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let disposed = false;
    let attempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let handshakeTimeout: ReturnType<typeof setTimeout> | null = null;
    let activeSocket: WebSocket | null = null;
    let generation = 0;

    const clearHandshakeTimeout = () => {
      if (handshakeTimeout) {
        clearTimeout(handshakeTimeout);
        handshakeTimeout = null;
      }
    };

    const connect = async () => {
      if (disposed) return;
      if (!navigator.onLine) { setConnected(false); return; }
      const currentGeneration = ++generation;

      if (attempts === 0) setConnecting(true);
      else setReconnecting(true);

      // Revalidate before upgrade too: an offline socket may miss its expiry close.
      const session = await request("POST", "/api/auth/ws-ticket");
      if (disposed || currentGeneration !== generation) return;
      if (!session.ok) {
        setConnected(false);
        if (session.status === 401) {
          queryClient.clear(); useAuthStore.getState().setUser(null); window.location.assign("/"); return;
        }
        setReconnecting(true);
        const delay = Math.min(1_000 * 2 ** Math.min(attempts++, 5), 30_000);
        reconnectTimeout = setTimeout(() => void connect(), delay); return;
      }
      const wsUrl =
        process.env.NEXT_PUBLIC_WS_URL ??
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:5173/ws`;
      const isDuplicate = createEventDeduplicator();
      const result = await session.json().catch(() => null);
      if (disposed || currentGeneration !== generation) return;
      if (!result || typeof result.ticket !== "string") {
        setConnected(false);
        setReconnecting(true);
        const delay = Math.min(1_000 * 2 ** Math.min(attempts++, 5), 30_000);
        reconnectTimeout = setTimeout(() => void connect(), delay);
        return;
      }
      const socketUrl = new URL(wsUrl);
      socketUrl.searchParams.set("ticket", result.ticket);
      const ws = new WebSocket(socketUrl);
      activeSocket = ws;
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed || currentGeneration !== generation || activeSocket !== ws) return;
        handshakeTimeout = setTimeout(() => {
          ws.close(4000, "WebSocket handshake timed out");
        }, 10_000);
      };

      ws.onmessage = (event) => {
        if (disposed || currentGeneration !== generation || activeSocket !== ws) return;
        if (typeof event.data !== "string") {
          if (process.env.NODE_ENV !== "production") {
            console.error("Ignored non-text WebSocket message");
          }
          return;
        }

        let decoded: unknown;
        try {
          decoded = JSON.parse(event.data);
        } catch {
          if (process.env.NODE_ENV !== "production") {
            console.error("Ignored malformed WebSocket message");
          }
          return;
        }

        const parsed = wsMessageSchema.safeParse(decoded);
        if (!parsed.success) {
          if (process.env.NODE_ENV !== "production") {
            console.error("Ignored invalid WebSocket message");
          }
          return;
        }

        const message: WsMessage = {
          type: parsed.data.type,
          payload: parsed.data.payload,
        };

        if (isDuplicate(message)) return;

        if (message.type === "WS_READY") {
          clearHandshakeTimeout();
          attempts = 0;
          setConnected(true);
          // Reconcile missed events on every successful connection.
          const roots = new Set(Object.values(resourceQueryRoots).flat());
          void queryClient.invalidateQueries({ predicate: (query) => roots.has(String(query.queryKey[0])) });

          const currentPath = pathnameRef.current;
          if (currentPath === "/panel" || currentPath.startsWith("/panel/")) {
            const subPath = currentPath.split("/panel/")[1]?.split("/")[0] || "dashboard";
            ws.send(
              JSON.stringify({ type: "CHANGE_PAGE", payload: [subPath] }),
            );
          }
          return;
        }

        const roots = affectedQueryRoots(message);
        if (roots.length) void queryClient.invalidateQueries({ predicate: (query) => roots.includes(String(query.queryKey[0])) });
        const listeners = listenersRef.current.get(message.type);
        listeners?.forEach((handler) => handler(message));
      };

      ws.onclose = async (event) => {
        if (disposed || currentGeneration !== generation || activeSocket !== ws) return;
        activeSocket = null;
        if (socketRef.current === ws) socketRef.current = null;
        clearHandshakeTimeout();
        setConnected(false);

        if (disposed) return;
        if (event.code === 4001) {
          queryClient.clear();
          useAuthStore.getState().setUser(null);
          window.location.assign("/");
          return;
        }
        if (event.code === 4002) {
          const refreshed = await refreshAccessToken();
          if (disposed || currentGeneration !== generation) return;
          if (!refreshed) {
            queryClient.clear();
            useAuthStore.getState().setUser(null);
            window.location.assign("/");
            return;
          }
        }

        if (!navigator.onLine) return;
        setReconnecting(true);
        const delay = Math.min(1_000 * 2 ** Math.min(attempts, 5), 30_000);
        attempts += 1;
        reconnectTimeout = setTimeout(connect, delay + Math.random() * 1_000);
      };
    };

    reconnectRef.current = () => {
      attempts = 0;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      clearHandshakeTimeout();
      if (activeSocket) {
        activeSocket.onmessage = null;
        activeSocket.onopen = null;
        activeSocket.onclose = null;
        activeSocket.close();
      }
      socketRef.current = null;
      setConnected(false);
      setConnecting(true);
      void connect();
    };

    const offline = () => {
      generation += 1;
      if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
      clearHandshakeTimeout();
      if (activeSocket) {
        activeSocket.onopen = null; activeSocket.onmessage = null; activeSocket.onclose = null;
        activeSocket.close(); activeSocket = null;
      }
      socketRef.current = null;
      setConnected(false);
    };
    const online = () => reconnectRef.current();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    void connect();

    return () => {
      disposed = true;
      generation += 1;
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      socketRef.current = null;
      setConnected(false);
      reconnectRef.current = () => {};
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearHandshakeTimeout();
      if (activeSocket) {
        activeSocket.onmessage = null;
        activeSocket.onopen = null;
        activeSocket.onclose = null;
        activeSocket.close();
      }
    };
  }, [setConnected, setConnecting, setReconnecting, queryClient]);

  const send = useCallback((data: unknown) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  }, []);

  const reconnect = useCallback(() => reconnectRef.current(), []);

  useEffect(() => {
    if (pathname !== "/panel" && !pathname.startsWith("/panel/")) return;
    send({
      type: "CHANGE_PAGE",
      payload: [pathname.split("/panel/")[1]?.split("/")[0] || "dashboard"],
    });
  }, [pathname, send]);

  return (
    <WebSocketContext.Provider value={{ send, subscribe, reconnect }}>
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
