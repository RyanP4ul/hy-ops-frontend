"use client";

import {
  Activity,
  BellRing,
  CheckCircle2,
  Clock3,
  Ellipsis,
  FileText,
  History,
  ListChecks,
  MailCheck,
  PackageSearch,
  Play,
  Settings2,
  Truck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { MotionPage } from "@/components/page-motion";
import { QueryFeedback } from "@/components/query-feedback";
import { ManagementPageHeading, ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableState, ManagementTableView } from "@/components/management-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { request } from "@/components/http";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type TaskStatus = "Enabled" | "Disabled" | "Failed";
type Frequency = "1" | "5" | "10" | "30" | "60" | "daily";
type TaskIcon = typeof PackageSearch;

type AutomationTask = {
  id: number;
  name: string;
  description: string;
  schedule: string;
  frequency: Frequency;
  dailyTime?: string;
  lastRun: string;
  lastRunAt: string | null;
  nextRun: string;
  status: TaskStatus;
  notes: string;
  icon: TaskIcon;
};

type AutomationRecord = {
  id: number;
  name: string;
  description: string;
  schedule: string;
  interval_ms: number | null;
  daily_time: string | null;
  status: "ENABLED" | "DISABLED" | "FAILED";
  notes: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
};

const frequencyLabels: Record<Frequency, string> = {
  "1": "Every 1 minute",
  "5": "Every 5 minutes",
  "10": "Every 10 minutes",
  "30": "Every 30 minutes",
  "60": "Every hour",
  daily: "Daily",
};

function taskIcon(name: string): TaskIcon {
  if (name.includes("Stock")) return PackageSearch;
  if (name.includes("Payment")) return MailCheck;
  if (name.includes("Delivery")) return Truck;
  if (name.includes("Notification")) return BellRing;
  if (name.includes("Summary")) return FileText;
  return Settings2;
}

function formatDate(value: string | null, fallback: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toTask(record: AutomationRecord): AutomationTask {
  const frequency = record.daily_time
    ? "daily"
    : String((record.interval_ms ?? 300000) / 60000) as Frequency;
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    schedule: record.schedule,
    frequency: frequency in frequencyLabels ? frequency : "5",
    dailyTime: record.daily_time ?? undefined,
    lastRun: formatDate(record.last_run_at, "Not run"),
    lastRunAt: record.last_run_at,
    nextRun: formatDate(record.next_run_at, record.status === "DISABLED" ? "Paused" : "Not scheduled"),
    status: record.status === "ENABLED" ? "Enabled" : record.status === "FAILED" ? "Failed" : "Disabled",
    notes: record.notes ?? "",
    icon: taskIcon(record.name),
  };
}

function statusVariant(status: TaskStatus) {
  if (status === "Failed") return "destructive" as const;
  if (status === "Disabled") return "secondary" as const;
  return "default" as const;
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant={statusVariant(status)} className={status === "Enabled" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : ""}>
      {status === "Enabled" ? <CheckCircle2 /> : status === "Failed" ? <XCircle /> : <Clock3 />}
      {status}
    </Badge>
  );
}

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<AutomationTask | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [runTask, setRunTask] = useState<AutomationTask | null>(null);
  const automationsQuery = useQuery({
    queryKey: ["automations"],
    queryFn: async () => {
      const response = await request("GET", "/api/automations");
      if (!response.ok) throw new Error("Failed to load automations");
      return (await response.json() as AutomationRecord[]).filter(record => record.name !== "Supabase Database Backup").map(toTask);
    },
  });
  const tasks = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);
  const enabledCount = tasks.filter((task) => task.status === "Enabled").length;
  const failedCount = tasks.filter((task) => task.status === "Failed").length;
  const lastRun = useMemo(() => {
    const latest = tasks.reduce<string | null>((current, task) => {
      if (!task.lastRunAt || !Number.isFinite(Date.parse(task.lastRunAt))) return current;
      return !current || Date.parse(task.lastRunAt) > Date.parse(current) ? task.lastRunAt : current;
    }, null);
    return formatDate(latest, "Not run");
  }, [tasks]);

  const saveMutation = useMutation({
    mutationFn: async (task: AutomationTask) => {
      const response = await request(
        "PUT",
        `/api/automations/${task.id}`,
        {
          name: task.name,
          description: task.description,
          schedule: task.frequency === "daily" ? `Daily at ${task.dailyTime || "02:00"}` : frequencyLabels[task.frequency],
          interval_ms: task.frequency === "daily" ? null : Number(task.frequency) * 60000,
          daily_time: task.frequency === "daily" ? task.dailyTime || "02:00" : null,
          status: task.status === "Enabled" ? "ENABLED" : task.status === "Failed" ? "FAILED" : "DISABLED",
          notes: task.notes || null,
        },
      );
      if (!response.ok) throw new Error((await response.text()) || "Failed to save automation");
    },
    onSuccess: () => {
      setEditingTask(null);
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automation saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (task: AutomationTask) => {
      const response = await request("POST", `/api/automations/${task.id}/toggle`, {
        enabled: task.status !== "Enabled",
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to update automation");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automation status updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const runMutation = useMutation({
    mutationFn: async (task: AutomationTask) => {
      const response = await request("POST", `/api/automations/${task.id}/run`);
      if (!response.ok) throw new Error((await response.text()) || "Failed to run automation");
    },
    onSuccess: () => {
      setRunTask(null);
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automation run completed");
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const keyword = search.trim().toLowerCase();
    return (statusFilter === "all" || task.status === statusFilter)
      && (!keyword || [task.name, task.description, task.schedule, task.notes].some((value) => value.toLowerCase().includes(keyword)));
  }), [tasks, search, statusFilter]);

  const columns: ColumnDef<AutomationTask>[] = [
    { accessorKey: "name", header: "Task", cell: ({ row }) => {
      const Icon = row.original.icon;
      return <div className="flex min-w-60 max-w-sm items-start gap-3">
        <div className="rounded-lg bg-muted p-2"><Icon className="size-4" aria-hidden="true" /></div>
        <div className="space-y-1 whitespace-normal"><p className="font-medium">{row.original.name}</p><p className="text-xs leading-relaxed text-muted-foreground">{row.original.description}</p></div>
      </div>;
    } },
    { accessorKey: "schedule", header: "Schedule" },
    { accessorKey: "lastRun", header: "Last run", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.lastRun}</span> },
    { accessorKey: "nextRun", header: "Next run", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.status === "Disabled" ? "Paused" : row.original.nextRun}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "actions", header: "Actions", cell: ({ row }) => <Actions task={row.original} onEdit={setEditingTask} onRun={setRunTask} onToggle={(task) => toggleMutation.mutate(task)} /> },
  ];
  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const filtered = Boolean(search.trim() || statusFilter !== "all");
  const statusOptions = [
    { value: "all", label: "All statuses" },
    { value: "Enabled", label: "Enabled" },
    { value: "Disabled", label: "Disabled" },
    { value: "Failed", label: "Failed" },
  ];

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <MotionPage className="flex flex-col gap-5 px-4 py-4 md:py-6 lg:px-6">
      <ManagementPageHeading title="Automations" description="Monitor recurring checks, review recent runs, and manage existing system tasks." icon={<Activity className="size-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="System tasks" value={automationsQuery.data ? tasks.length : "—"} description="Recurring operational tasks" icon={ListChecks} />
        <SummaryCard title="Enabled" value={automationsQuery.data ? enabledCount : "—"} description="Currently active" icon={CheckCircle2} />
        <SummaryCard title="Failed tasks" value={automationsQuery.data ? failedCount : "—"} description="Tasks needing attention" icon={XCircle} />
        <SummaryCard title="Last run" value={automationsQuery.data ? lastRun : "—"} description="Most recent recorded execution" icon={History} />
      </div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ManagementListHeader title="Scheduled tasks" description="Review schedules, update configurations, or run an existing task."
          total={automationsQuery.data ? filteredTasks.length : undefined} isFetching={automationsQuery.isFetching} onRefresh={() => void automationsQuery.refetch()} />
        <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
          <ManagementSearch id="automation-search" value={search} placeholder="Search tasks or schedules…" onChange={(value) => { setSearch(value); setPagination((current) => ({ ...current, pageIndex: 0 })); }} onClear={() => { setSearch(""); setPagination((current) => ({ ...current, pageIndex: 0 })); }} />
          <Select items={statusOptions} value={statusFilter} onValueChange={(value) => { setStatusFilter(value ?? "all"); setPagination((current) => ({ ...current, pageIndex: 0 })); }}>
            <SelectTrigger className="h-10 w-full bg-background sm:w-44" aria-label="Filter tasks by status"><SelectValue /></SelectTrigger>
            <SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          {filtered && <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filters</Button>}
        </div>
        <QueryFeedback query={automationsQuery} label="automations" />
        <div className="hidden md:block">
          <ManagementTableView table={table} loading={automationsQuery.isPending} isFetching={automationsQuery.isFetching} error={automationsQuery.isError} filtered={filtered} label="automation tasks" />
        </div>
        <div className="divide-y md:hidden" aria-busy={automationsQuery.isFetching}>
          {automationsQuery.isPending ? <ManagementTableState loading label="automation tasks" /> : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TaskMobileCard key={row.original.id} task={row.original} onEdit={setEditingTask} onRun={setRunTask} onToggle={(task) => toggleMutation.mutate(task)} />) : <ManagementTableState error={automationsQuery.isError} filtered={filtered} label="automation tasks" />}
        </div>
        <ManagementListFooter table={table} total={filteredTasks.length} isFetching={automationsQuery.isFetching} label="Automations" />
      </section>
      <TaskDialog key={editingTask?.id ?? "none"} task={editingTask} open={editingTask !== null} onOpenChange={(open) => !open && setEditingTask(null)} onSave={(task) => saveMutation.mutate(task)} isSaving={saveMutation.isPending} />
      <Dialog open={runTask !== null} onOpenChange={(open) => !open && setRunTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Run this task now?</DialogTitle><DialogDescription>This will execute {runTask?.name ?? "the selected task"} immediately.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={runMutation.isPending} onClick={() => setRunTask(null)}>Cancel</Button><Button onClick={() => runTask && runMutation.mutate(runTask)} disabled={runMutation.isPending}><Play />{runMutation.isPending ? "Running…" : "Run now"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
}

function SummaryCard({ title, value, description, icon: Icon }: { title: string; value: string | number; description: string; icon: typeof Activity }) {
  return <Card className="rounded-xl shadow-sm"><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div><p className="text-xs text-muted-foreground">{description}</p></CardContent></Card>;
}

function Actions({ task, onEdit, onRun, onToggle }: { task: AutomationTask; onEdit: (task: AutomationTask) => void; onRun: (task: AutomationTask) => void; onToggle: (task: AutomationTask) => void }) {
  return <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.name}`} />}><Ellipsis /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onEdit(task)}><Settings2 /> View Details</DropdownMenuItem><DropdownMenuItem onClick={() => onEdit(task)}><Settings2 /> Edit Configuration</DropdownMenuItem><DropdownMenuItem onClick={() => onRun(task)}><Play /> Run Now</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => onToggle(task)}><Activity /> {task.status === "Enabled" ? "Disable" : "Enable"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function TaskMobileCard({ task, onEdit, onRun, onToggle }: { task: AutomationTask; onEdit: (task: AutomationTask) => void; onRun: (task: AutomationTask) => void; onToggle: (task: AutomationTask) => void }) {
  const Icon = task.icon;
  return <div className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="rounded-md bg-muted p-2"><Icon className="size-4" /></div><div><p className="font-medium">{task.name}</p><p className="text-sm text-muted-foreground">{task.description}</p></div></div><Actions task={task} onEdit={onEdit} onRun={onRun} onToggle={onToggle} /></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Schedule</p><p>{task.schedule}</p></div><div><p className="text-xs text-muted-foreground">Next run</p><p>{task.status === "Disabled" ? "Paused" : task.nextRun}</p></div></div><StatusBadge status={task.status} /></div>;
}

function TaskDialog({ task, open, onOpenChange, onSave, isSaving }: { task: AutomationTask | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (task: AutomationTask) => void; isSaving: boolean }) {
  const [form, setForm] = useState<AutomationTask | null>(task);
  if (!form) return null;
  const setField = <K extends keyof AutomationTask>(key: K, value: AutomationTask[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{form.name}</DialogTitle><DialogDescription>Update the schedule and configuration of this existing task.</DialogDescription></DialogHeader><div className="space-y-4"><StatusBadge status={form.status} /><Separator /><div className="space-y-2"><Label htmlFor="task-name">Task name</Label><Input id="task-name" value={form.name} onChange={(event) => setField("name", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" value={form.description} onChange={(event) => setField("description", event.target.value)} /></div><div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="task-enabled">Enable task</Label><p className="text-xs text-muted-foreground">Updates the persisted automation status.</p></div><Switch id="task-enabled" checked={form.status === "Enabled"} onCheckedChange={(checked) => setField("status", checked ? "Enabled" : "Disabled")} /></div><div className="space-y-2"><Label htmlFor="task-frequency">Frequency</Label><Select value={form.frequency} onValueChange={(value) => setField("frequency", value as Frequency)}><SelectTrigger id="task-frequency" className="w-full"><SelectValue placeholder="Choose frequency" /></SelectTrigger><SelectContent>{Object.entries(frequencyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>{form.frequency === "daily" && <div className="space-y-2"><Label htmlFor="task-daily-time">Daily execution time</Label><Input id="task-daily-time" type="time" value={form.dailyTime || "02:00"} onChange={(event) => setField("dailyTime", event.target.value)} /></div>}<div className="space-y-2"><Label htmlFor="task-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="task-notes" value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!form.name.trim() || !form.description.trim() || isSaving} onClick={() => onSave(form)}>Save Changes</Button></DialogFooter></DialogContent></Dialog>;
}
