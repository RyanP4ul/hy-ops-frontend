"use client";

import WsStatus from "../ws-status";
import WsDisconnect from "../ws-status";
import { useConnectionStore } from "@/stores/connection-store";

export function ConnectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { connected, reconnecting, connecting } = useConnectionStore();

  if (connecting) return <WsStatus status="connecting" />;
  if (reconnecting) return <WsStatus status="reconnecting" />;
  if (!connected) return <WsStatus status="disconnected" />;

  return children;
}
