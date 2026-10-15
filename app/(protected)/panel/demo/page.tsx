"use client";

import * as React from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Laptop,
  LogIn,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Search,
  Server,
  Smartphone,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type UserRole = "admin" | "staff" | "driver";

type SessionStatus = "active" | "expired" | "revoked";

type Session = {
  id: string;
  userId: number;
  userName: string;
  role: UserRole;
  connectionId: string;
  device: string;
  browser: string;
  ipAddress: string;
  startedAt: string;
  lastActiveAt: string;
  status: SessionStatus;
};

type WebSocketLogType =
  | "connect"
  | "disconnect"
  | "message"
  | "error"
  | "ping"
  | "pong";

type WebSocketDirection = "client_to_server" | "server_to_client" | null;

type WebSocketLogStatus = "success" | "error";

type WebSocketLog = {
  id: number;
  userId: number | null;
  userName: string | null;
  sessionId: string | null;
  connectionId: string;

  type: WebSocketLogType;
  event: string | null;
  direction: WebSocketDirection;

  status: WebSocketLogStatus;

  payload: unknown | null;

  durationMs: number | null;

  ipAddress: string | null;
  userAgent: string | null;

  createdAt: string;
};

/* -------------------------------------------------------------------------- */
/* Mock Data                                                                  */
/* -------------------------------------------------------------------------- */

const sessions: Session[] = [
  {
    id: "session_8f32a1",
    userId: 1,
    userName: "Juan Dela Cruz",
    role: "admin",
    connectionId: "ws_8f32a1",
    device: "Windows 11",
    browser: "Chrome 140",
    ipAddress: "192.168.1.10",
    startedAt: "2026-09-11T10:32:00",
    lastActiveAt: "2026-09-11T11:09:42",
    status: "active",
  },
  {
    id: "session_71ac92",
    userId: 2,
    userName: "Mark Santos",
    role: "staff",
    connectionId: "ws_71ac92",
    device: "Windows 11",
    browser: "Edge 140",
    ipAddress: "192.168.1.15",
    startedAt: "2026-09-11T11:01:00",
    lastActiveAt: "2026-09-11T11:08:41",
    status: "active",
  },
  {
    id: "session_92de31",
    userId: 3,
    userName: "Pedro Reyes",
    role: "driver",
    connectionId: "ws_92de31",
    device: "Android",
    browser: "Chrome Mobile",
    ipAddress: "192.168.1.20",
    startedAt: "2026-09-11T11:06:00",
    lastActiveAt: "2026-09-11T11:09:10",
    status: "active",
  },
  {
    id: "session_14ab82",
    userId: 4,
    userName: "Anna Garcia",
    role: "staff",
    connectionId: "ws_14ab82",
    device: "Windows 10",
    browser: "Chrome 140",
    ipAddress: "192.168.1.25",
    startedAt: "2026-09-10T08:12:00",
    lastActiveAt: "2026-09-10T17:32:00",
    status: "expired",
  },
  {
    id: "session_32ac81",
    userId: 5,
    userName: "Michael Tan",
    role: "driver",
    connectionId: "ws_32ac81",
    device: "Android",
    browser: "Chrome Mobile",
    ipAddress: "192.168.1.30",
    startedAt: "2026-09-10T09:22:00",
    lastActiveAt: "2026-09-10T15:11:00",
    status: "revoked",
  },
];

const websocketLogs: WebSocketLog[] = [
  {
    id: 1,
    userId: 1,
    userName: "Juan Dela Cruz",
    sessionId: "session_8f32a1",
    connectionId: "ws_8f32a1",
    type: "message",
    event: "inventory.updated",
    direction: "server_to_client",
    status: "success",
    durationMs: 32,
    ipAddress: "192.168.1.10",
    userAgent: "Chrome 140 / Windows 11",
    createdAt: "2026-09-11T11:09:42",
    payload: {
      productId: 12,
      quantity: 84,
      warehouseId: 1,
    },
  },
  {
    id: 2,
    userId: 2,
    userName: "Mark Santos",
    sessionId: "session_71ac92",
    connectionId: "ws_71ac92",
    type: "message",
    event: "order.created",
    direction: "client_to_server",
    status: "success",
    durationMs: 18,
    ipAddress: "192.168.1.15",
    userAgent: "Edge 140 / Windows 11",
    createdAt: "2026-09-11T11:09:38",
    payload: {
      orderId: 1024,
      customerId: 17,
      totalItems: 12,
    },
  },
  {
    id: 3,
    userId: 3,
    userName: "Pedro Reyes",
    sessionId: "session_92de31",
    connectionId: "ws_92de31",
    type: "message",
    event: "location.update",
    direction: "client_to_server",
    status: "success",
    durationMs: 11,
    ipAddress: "192.168.1.20",
    userAgent: "Chrome Mobile / Android",
    createdAt: "2026-09-11T11:09:31",
    payload: {
      deliveryId: 52,
      latitude: 14.8791,
      longitude: 120.9602,
    },
  },
  {
    id: 4,
    userId: 1,
    userName: "Juan Dela Cruz",
    sessionId: "session_8f32a1",
    connectionId: "ws_8f32a1",
    type: "message",
    event: "delivery.updated",
    direction: "server_to_client",
    status: "success",
    durationMs: 27,
    ipAddress: "192.168.1.10",
    userAgent: "Chrome 140 / Windows 11",
    createdAt: "2026-09-11T11:09:31",
    payload: {
      deliveryId: 52,
      status: "out_for_delivery",
      driverId: 3,
    },
  },
  {
    id: 5,
    userId: 2,
    userName: "Mark Santos",
    sessionId: "session_71ac92",
    connectionId: "ws_71ac92",
    type: "ping",
    event: "ping",
    direction: "client_to_server",
    status: "success",
    durationMs: 3,
    ipAddress: "192.168.1.15",
    userAgent: "Edge 140 / Windows 11",
    createdAt: "2026-09-11T11:09:22",
    payload: null,
  },
  {
    id: 6,
    userId: 1,
    userName: "Juan Dela Cruz",
    sessionId: "session_8f32a1",
    connectionId: "ws_8f32a1",
    type: "error",
    event: "message.error",
    direction: "server_to_client",
    status: "error",
    durationMs: 12,
    ipAddress: "192.168.1.10",
    userAgent: "Chrome 140 / Windows 11",
    createdAt: "2026-09-11T11:09:18",
    payload: {
      code: "INVALID_PAYLOAD",
      message: "Invalid inventory update payload.",
    },
  },
  {
    id: 7,
    userId: 2,
    userName: "Mark Santos",
    sessionId: "session_71ac92",
    connectionId: "ws_71ac92",
    type: "connect",
    event: "connection.open",
    direction: null,
    status: "success",
    durationMs: null,
    ipAddress: "192.168.1.15",
    userAgent: "Edge 140 / Windows 11",
    createdAt: "2026-09-11T11:01:00",
    payload: {
      path: "/ws",
    },
  },
  {
    id: 8,
    userId: 3,
    userName: "Pedro Reyes",
    sessionId: "session_92de31",
    connectionId: "ws_92de31",
    type: "disconnect",
    event: "connection.close",
    direction: null,
    status: "success",
    durationMs: null,
    ipAddress: "192.168.1.20",
    userAgent: "Chrome Mobile / Android",
    createdAt: "2026-09-11T10:58:11",
    payload: {
      code: 1000,
      reason: "Normal closure",
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();

  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return `${Math.max(seconds, 0)}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function getRoleBadgeVariant(role: UserRole) {
  switch (role) {
    case "admin":
      return "default";
    case "staff":
      return "secondary";
    case "driver":
      return "outline";
  }
}

function getStatusBadge(status: SessionStatus) {
  switch (status) {
    case "active":
      return (
        <Badge className="gap-1">
          <span className="size-1.5 rounded-full bg-current" />
          Active
        </Badge>
      );

    case "expired":
      return <Badge variant="secondary">Expired</Badge>;

    case "revoked":
      return <Badge variant="destructive">Revoked</Badge>;
  }
}

function getLogTypeBadge(type: WebSocketLogType) {
  switch (type) {
    case "connect":
      return (
        <Badge variant="secondary" className="gap-1">
          <LogIn className="size-3" />
          Connect
        </Badge>
      );

    case "disconnect":
      return (
        <Badge variant="outline" className="gap-1">
          <LogOut className="size-3" />
          Disconnect
        </Badge>
      );

    case "message":
      return (
        <Badge variant="default" className="gap-1">
          <Activity className="size-3" />
          Message
        </Badge>
      );

    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <CircleAlert className="size-3" />
          Error
        </Badge>
      );

    case "ping":
      return (
        <Badge variant="secondary" className="gap-1">
          <Wifi className="size-3" />
          Ping
        </Badge>
      );

    case "pong":
      return (
        <Badge variant="secondary" className="gap-1">
          <Wifi className="size-3" />
          Pong
        </Badge>
      );
  }
}

function getDirection(direction: WebSocketDirection) {
  if (direction === "client_to_server") {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <ArrowUpFromLine className="size-4" />
        <span>Server</span>
      </div>
    );
  }

  if (direction === "server_to_client") {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <ArrowDownToLine className="size-4" />
        <span>Client</span>
      </div>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}

function getDeviceIcon(device: string) {
  if (device.toLowerCase().includes("android")) {
    return Smartphone;
  }

  return Laptop;
}

/* -------------------------------------------------------------------------- */
/* Stat Card                                                                  */
/* -------------------------------------------------------------------------- */

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>

        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-bold">{value}</div>

        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Session Details                                                            */
/* -------------------------------------------------------------------------- */

function SessionDetailsSheet({
  session,
  open,
  onOpenChange,
  onRevoke,
}: {
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevoke: (session: Session) => void;
}) {
  if (!session) {
    return null;
  }

  const DeviceIcon = getDeviceIcon(session.device);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Session Details</SheetTitle>

          <SheetDescription>
            Information about this user session.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <DeviceIcon className="size-5" />
            </div>

            <div>
              <p className="font-medium">{session.userName}</p>

              <Badge
                variant={getRoleBadgeVariant(session.role)}
                className="mt-1 capitalize"
              >
                {session.role}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <DetailItem label="Status" value={getStatusBadge(session.status)} />

            <DetailItem
              label="Session ID"
              value={<CodeValue value={session.id} />}
            />

            <DetailItem
              label="WebSocket Connection"
              value={<CodeValue value={session.connectionId} />}
            />

            <DetailItem label="IP Address" value={session.ipAddress} />

            <DetailItem label="Device" value={session.device} />

            <DetailItem label="Browser" value={session.browser} />

            <DetailItem label="Started" value={formatDate(session.startedAt)} />

            <DetailItem
              label="Last Active"
              value={formatDate(session.lastActiveAt)}
            />
          </div>

          {session.status === "active" && (
            <>
              <Separator />

              <Button
                variant="destructive"
                className="w-full"
                onClick={() => onRevoke(session)}
              >
                <WifiOff className="mr-2 size-4" />
                Revoke Session
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* WebSocket Log Details                                                      */
/* -------------------------------------------------------------------------- */

function WebSocketLogDetailsSheet({
  log,
  open,
  onOpenChange,
}: {
  log: WebSocketLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{log.event ?? "WebSocket Event"}</SheetTitle>

          <SheetDescription>WebSocket activity details.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <div className="flex items-center gap-2">
            {getLogTypeBadge(log.type)}

            {log.direction && getDirection(log.direction)}
          </div>

          <Separator />

          <div className="grid gap-5">
            <DetailItem
              label="Status"
              value={
                log.status === "success" ? (
                  <Badge className="gap-1">
                    <CheckCircle2 className="size-3" />
                    Success
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="size-3" />
                    Error
                  </Badge>
                )
              }
            />

            <DetailItem label="User" value={log.userName ?? "System"} />

            <DetailItem
              label="Connection ID"
              value={<CodeValue value={log.connectionId} />}
            />

            <DetailItem
              label="Session ID"
              value={log.sessionId ? <CodeValue value={log.sessionId} /> : "—"}
            />

            <DetailItem label="IP Address" value={log.ipAddress ?? "—"} />

            <DetailItem
              label="Duration"
              value={log.durationMs != null ? `${log.durationMs} ms` : "—"}
            />

            <DetailItem label="Timestamp" value={formatDate(log.createdAt)} />
          </div>

          {log.userAgent && (
            <>
              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">User Agent</p>

                <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">
                  {log.userAgent}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Payload</p>

              {log.payload != null && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(log.payload, null, 2),
                    );
                  }}
                >
                  <Copy className="mr-2 size-3.5" />
                  Copy
                </Button>
              )}
            </div>

            <pre className="max-h-80 overflow-auto rounded-lg border bg-muted p-4 text-xs leading-5">
              {log.payload == null
                ? "No payload"
                : JSON.stringify(log.payload, null, 2)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail Item                                                                */
/* -------------------------------------------------------------------------- */

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <div className="text-sm">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Code Value                                                                 */
/* -------------------------------------------------------------------------- */

function CodeValue({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-muted px-2 py-1 text-xs">{value}</code>

      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => {
          navigator.clipboard.writeText(value);
        }}
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sessions Tab                                                               */
/* -------------------------------------------------------------------------- */

function SessionsTab() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | SessionStatus>("all");

  const [selectedSession, setSelectedSession] = React.useState<Session | null>(
    null,
  );

  const [sheetOpen, setSheetOpen] = React.useState(false);

  const filteredSessions = React.useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return sessions.filter((session) => {
      const matchesSearch =
        !normalizedSearch ||
        session.userName.toLowerCase().includes(normalizedSearch) ||
        session.ipAddress.toLowerCase().includes(normalizedSearch) ||
        session.connectionId.toLowerCase().includes(normalizedSearch);

      const matchesStatus = status === "all" || session.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  function openSession(session: Session) {
    setSelectedSession(session);
    setSheetOpen(true);
  }

  function revokeSession(session: Session) {
    console.log("Revoke session:", session.id);

    setSheetOpen(false);

    // Replace this with your mutation:
    //
    // await revokeSessionMutation.mutateAsync(session.id)
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Active Sessions"
            value="3"
            description="Currently signed in"
            icon={Wifi}
          />

          <StatCard
            title="Sessions Today"
            value="27"
            description="New sessions created today"
            icon={LogIn}
          />

          <StatCard
            title="Expired Sessions"
            value="18"
            description="Automatically expired"
            icon={Clock3}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Active & Recent Sessions</CardTitle>

                <p className="mt-1 text-sm text-muted-foreground">
                  Manage user login sessions and WebSocket connections.
                </p>
              </div>

              <Button variant="outline" size="sm">
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row">
              <InputGroup className="flex-1">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>

                <InputGroupInput
                  placeholder="Search user, IP address, or connection..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </InputGroup>

              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as "all" | SessionStatus)
                }
              >
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="size-5 text-muted-foreground" />

                          <p className="text-sm text-muted-foreground">
                            No sessions found.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSessions.map((session) => {
                      const DeviceIcon = getDeviceIcon(session.device);

                      return (
                        <TableRow
                          key={session.id}
                          className="cursor-pointer"
                          onClick={() => openSession(session)}
                        >
                          <TableCell>
                            <div className="font-medium">
                              {session.userName}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {session.connectionId}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={getRoleBadgeVariant(session.role)}
                              className="capitalize"
                            >
                              {session.role}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <DeviceIcon className="size-4 text-muted-foreground" />

                              <div>
                                <p className="text-sm">{session.browser}</p>

                                <p className="text-xs text-muted-foreground">
                                  {session.device}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <code className="text-xs">{session.ipAddress}</code>
                          </TableCell>

                          <TableCell>
                            <div className="text-sm">
                              {formatRelativeTime(session.lastActiveAt)}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {formatTime(session.lastActiveAt)}
                            </div>
                          </TableCell>

                          <TableCell>
                            {getStatusBadge(session.status)}
                          </TableCell>

                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                onClick={(event) => event.stopPropagation()}
                                render={
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                }
                              />

                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openSession(session)}
                                >
                                  View Details
                                </DropdownMenuItem>

                                {session.status === "active" && (
                                  <>
                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => revokeSession(session)}
                                    >
                                      Revoke Session
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <Pagination />
          </CardContent>
        </Card>
      </div>

      <SessionDetailsSheet
        session={selectedSession}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onRevoke={revokeSession}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* WebSocket Logs Tab                                                         */
/* -------------------------------------------------------------------------- */

function WebSocketLogsTab() {
  const [search, setSearch] = React.useState("");

  const [type, setType] = React.useState<"all" | WebSocketLogType>("all");

  const [status, setStatus] = React.useState<"all" | WebSocketLogStatus>("all");

  const [direction, setDirection] = React.useState<
    "all" | "client_to_server" | "server_to_client"
  >("all");

  const [selectedLog, setSelectedLog] = React.useState<WebSocketLog | null>(
    null,
  );

  const [sheetOpen, setSheetOpen] = React.useState(false);

  const filteredLogs = React.useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return websocketLogs.filter((log) => {
      const matchesSearch =
        !normalizedSearch ||
        log.event?.toLowerCase().includes(normalizedSearch) ||
        log.userName?.toLowerCase().includes(normalizedSearch) ||
        log.connectionId.toLowerCase().includes(normalizedSearch);

      const matchesType = type === "all" || log.type === type;

      const matchesStatus = status === "all" || log.status === status;

      const matchesDirection =
        direction === "all" || log.direction === direction;

      return matchesSearch && matchesType && matchesStatus && matchesDirection;
    });
  }, [search, type, status, direction]);

  function openLog(log: WebSocketLog) {
    setSelectedLog(log);
    setSheetOpen(true);
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Active Connections"
            value="12"
            description="Currently connected"
            icon={Wifi}
          />

          <StatCard
            title="Messages Today"
            value="8,421"
            description="WebSocket messages"
            icon={Activity}
          />

          <StatCard
            title="Errors Today"
            value="14"
            description="Failed WebSocket events"
            icon={CircleAlert}
          />

          <StatCard
            title="Avg. Latency"
            value="42 ms"
            description="Average message duration"
            icon={Clock3}
          />
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>WebSocket Activity</CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Monitor connections, messages, errors, and disconnections.
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>

                <InputGroupInput
                  placeholder="Search event, user, or connection..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </InputGroup>

              <Select
                value={type}
                onValueChange={(value) =>
                  setType(value as "all" | WebSocketLogType)
                }
              >
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>

                  <SelectItem value="connect">Connect</SelectItem>

                  <SelectItem value="disconnect">Disconnect</SelectItem>

                  <SelectItem value="message">Message</SelectItem>

                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={direction}
                onValueChange={(value) =>
                  setDirection(
                    value as "all" | "client_to_server" | "server_to_client",
                  )
                }
              >
                <SelectTrigger className="w-full lg:w-[170px]">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>

                  <SelectItem value="client_to_server">
                    Client → Server
                  </SelectItem>

                  <SelectItem value="server_to_client">
                    Server → Client
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as "all" | WebSocketLogStatus)
                }
              >
                <SelectTrigger className="w-full lg:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>

                  <SelectItem value="success">Success</SelectItem>

                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="size-5 text-muted-foreground" />

                          <p className="text-sm text-muted-foreground">
                            No WebSocket logs found.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() => openLog(log)}
                      >
                        <TableCell>
                          <div className="text-sm">
                            {formatTime(log.createdAt)}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {formatRelativeTime(log.createdAt)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">
                            {log.userName ?? "System"}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {log.connectionId}
                          </div>
                        </TableCell>

                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {log.event ?? "—"}
                          </code>
                        </TableCell>

                        <TableCell>{getLogTypeBadge(log.type)}</TableCell>

                        <TableCell>{getDirection(log.direction)}</TableCell>

                        <TableCell>
                          {log.status === "success" ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="size-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="size-3" />
                              Error
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          {log.durationMs != null
                            ? `${log.durationMs} ms`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Pagination />
          </CardContent>
        </Card>
      </div>

      <WebSocketLogDetailsSheet
        log={selectedLog}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */

function Pagination() {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Showing <strong>1–10</strong> of <strong>128</strong>
      </p>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" disabled>
          <ChevronLeft />
        </Button>

        <Button variant="outline" size="sm">
          1
        </Button>

        <Button variant="ghost" size="sm">
          2
        </Button>

        <Button variant="ghost" size="sm">
          3
        </Button>

        <Button variant="outline" size="icon">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Page                                                                  */
/* -------------------------------------------------------------------------- */

export default function SessionsLogsPage() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Session & Logs
        </h1>

        <p className="text-sm text-muted-foreground">
          Monitor user sessions and real-time WebSocket activity.
        </p>
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>

          <TabsTrigger value="websocket">WebSocket Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionsTab />
        </TabsContent>

        <TabsContent value="websocket">
          <WebSocketLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
