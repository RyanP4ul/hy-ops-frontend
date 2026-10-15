import { LoaderCircle, RefreshCw, WifiOff } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";

type Status = "connecting" | "reconnecting" | "disconnected";

interface WsStatusProps {
  status: Status;
}

const statusConfig = {
  connecting: {
    title: "Connecting...",
    description: "Establishing a connection to the server. Please wait.",
    icon: (
      <LoaderCircle className="h-12 w-12 animate-spin text-muted-foreground" />
    ),
  },
  reconnecting: {
    title: "Reconnecting...",
    description:
      "The connection was interrupted. Attempting to reconnect automatically.",
    icon: (
      <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
    ),
  },
  disconnected: {
    title: "Disconnected",
    description:
      "The connection to the server has been lost. Please check your network connection and try again.",
    icon: <WifiOff className="h-12 w-12 text-muted-foreground" />,
  },
};

export default function WsStatus({ status }: WsStatusProps) {
  const config = statusConfig[status];

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">{config.icon}</EmptyMedia>

        <EmptyTitle>{config.title}</EmptyTitle>

        <EmptyDescription>{config.description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
