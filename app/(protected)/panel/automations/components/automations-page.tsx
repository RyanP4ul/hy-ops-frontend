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
  Plus,
  RefreshCw,
  Settings2,
  Truck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { request } from "@/components/http";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  if (!value) return fallback;
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
    <Badge variant={statusVariant(status)}>
      {status === "Enabled" ? <CheckCircle2 /> : status === "Failed" ? <XCircle /> : <Clock3 />}
      {status}
    </Badge>
  );
}

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<AutomationTask | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [runTask, setRunTask] = useState<AutomationTask | null>(null);
  const automationsQuery = useQuery({
    queryKey: ["automations"],
    queryFn: async () => {
      const response = await request("GET", "/api/automations");
      if (!response.ok) throw new Error("Failed to load automations");
      return (await response.json() as AutomationRecord[]).map(toTask);
    },
  });
  const tasks = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);
  const enabledCount = tasks.filter((task) => task.status === "Enabled").length;
  const failedCount = tasks.filter((task) => task.status === "Failed").length;
  const lastRun = useMemo(() => {
    const runs = tasks.filter((task) => task.lastRun !== "Not run").map((task) => task.lastRun);
    return runs[0] ?? "Not run";
  }, [tasks]);

  const saveMutation = useMutation({
    mutationFn: async (task: AutomationTask) => {
      const response = await request(
        task.id === 0 ? "POST" : "PUT",
        task.id === 0 ? "/api/automations" : `/api/automations/${task.id}`,
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
      setIsAddOpen(false);
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

  return (
    <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="size-4" />System operations</div>
          <h1 className="text-3xl font-semibold tracking-tight">Automations</h1>
          <p className="text-muted-foreground">Manage recurring checks and scheduled system tasks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void automationsQuery.refetch()} disabled={automationsQuery.isFetching}><RefreshCw className={automationsQuery.isFetching ? "animate-spin" : ""} /> Refresh</Button>
          <Button onClick={() => setIsAddOpen(true)}><Plus /> Add Task</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Tasks" value={tasks.length} description="Registered database tasks" icon={ListChecks} />
        <SummaryCard title="Enabled" value={enabledCount} description="Currently active" icon={CheckCircle2} />
        <SummaryCard title="Failed Runs" value={failedCount} description="Current failed status" icon={XCircle} />
        <SummaryCard title="Last Run" value={lastRun} description="Most recent execution" icon={History} />
      </div>
      <Card>
        <CardHeader><CardTitle>Scheduled tasks</CardTitle><CardDescription>Task configuration is stored in the database.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {automationsQuery.isLoading ? <div className="p-8 text-center text-muted-foreground">Loading automations...</div> : automationsQuery.isError ? <div className="p-8 text-center text-destructive">Unable to load automations.</div> : <>
            <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead className="pl-6">Task</TableHead><TableHead>Description</TableHead><TableHead>Schedule</TableHead><TableHead>Last run</TableHead><TableHead>Next run</TableHead><TableHead>Status</TableHead><TableHead className="pr-6 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{tasks.map((task) => <TaskRow key={task.id} task={task} onEdit={setEditingTask} onRun={setRunTask} onToggle={(item) => toggleMutation.mutate(item)} />)}</TableBody></Table></div>
            <div className="divide-y md:hidden">{tasks.map((task) => <TaskMobileCard key={task.id} task={task} onEdit={setEditingTask} onRun={setRunTask} onToggle={(item) => toggleMutation.mutate(item)} />)}</div>
          </>}
        </CardContent>
      </Card>
      <TaskDialog key={editingTask?.id ?? "none"} task={editingTask} open={editingTask !== null} onOpenChange={(open) => !open && setEditingTask(null)} onSave={(task) => saveMutation.mutate(task)} isSaving={saveMutation.isPending} />
      <TaskDialog key={isAddOpen ? "new" : "closed"} task={isAddOpen ? emptyTask() : null} open={isAddOpen} onOpenChange={setIsAddOpen} onSave={(task) => saveMutation.mutate(task)} isSaving={saveMutation.isPending} />
      <Dialog open={runTask !== null} onOpenChange={(open) => !open && setRunTask(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Run this task now?</DialogTitle><DialogDescription>This will execute the registered backend task immediately.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRunTask(null)}>Cancel</Button><Button onClick={() => runTask && runMutation.mutate(runTask)} disabled={runMutation.isPending}><Play /> Run Now</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}

function SummaryCard({ title, value, description, icon: Icon }: { title: string; value: string | number; description: string; icon: typeof Activity }) {
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div><p className="text-xs text-muted-foreground">{description}</p></CardContent></Card>;
}

function Actions({ task, onEdit, onRun, onToggle }: { task: AutomationTask; onEdit: (task: AutomationTask) => void; onRun: (task: AutomationTask) => void; onToggle: (task: AutomationTask) => void }) {
  return <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.name}`} />}><Ellipsis /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onEdit(task)}><Settings2 /> View Details</DropdownMenuItem><DropdownMenuItem onClick={() => onEdit(task)}><Settings2 /> Edit Configuration</DropdownMenuItem><DropdownMenuItem onClick={() => onRun(task)}><Play /> Run Now</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => onToggle(task)}><Activity /> {task.status === "Enabled" ? "Disable" : "Enable"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function TaskRow({ task, onEdit, onRun, onToggle }: { task: AutomationTask; onEdit: (task: AutomationTask) => void; onRun: (task: AutomationTask) => void; onToggle: (task: AutomationTask) => void }) {
  const Icon = task.icon;
  return <TableRow><TableCell className="pl-6"><div className="flex items-center gap-3"><div className="rounded-md bg-muted p-2"><Icon className="size-4" /></div><span className="font-medium">{task.name}</span></div></TableCell><TableCell className="max-w-xs whitespace-normal text-muted-foreground">{task.description}</TableCell><TableCell>{task.schedule}</TableCell><TableCell className="text-muted-foreground">{task.lastRun}</TableCell><TableCell className="text-muted-foreground">{task.status === "Disabled" ? "Paused" : task.nextRun}</TableCell><TableCell><StatusBadge status={task.status} /></TableCell><TableCell className="pr-6 text-right"><Actions task={task} onEdit={onEdit} onRun={onRun} onToggle={onToggle} /></TableCell></TableRow>;
}

function TaskMobileCard({ task, onEdit, onRun, onToggle }: { task: AutomationTask; onEdit: (task: AutomationTask) => void; onRun: (task: AutomationTask) => void; onToggle: (task: AutomationTask) => void }) {
  const Icon = task.icon;
  return <div className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="rounded-md bg-muted p-2"><Icon className="size-4" /></div><div><p className="font-medium">{task.name}</p><p className="text-sm text-muted-foreground">{task.description}</p></div></div><Actions task={task} onEdit={onEdit} onRun={onRun} onToggle={onToggle} /></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Schedule</p><p>{task.schedule}</p></div><div><p className="text-xs text-muted-foreground">Next run</p><p>{task.status === "Disabled" ? "Paused" : task.nextRun}</p></div></div><StatusBadge status={task.status} /></div>;
}

function emptyTask(): AutomationTask {
  return { id: 0, name: "", description: "", schedule: "Every 5 minutes", frequency: "5", lastRun: "Not run", nextRun: "Not scheduled", status: "Disabled", notes: "", icon: Settings2 };
}

function TaskDialog({ task, open, onOpenChange, onSave, isSaving }: { task: AutomationTask | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (task: AutomationTask) => void; isSaving: boolean }) {
  const [form, setForm] = useState<AutomationTask | null>(task);
  if (!form) return null;
  const setField = <K extends keyof AutomationTask>(key: K, value: AutomationTask[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{task?.id === 0 ? "Add task" : form.name}</DialogTitle><DialogDescription>{task?.id === 0 ? "Create a database-backed automation." : "Changes are applied to the database and runtime task."}</DialogDescription></DialogHeader><div className="space-y-4">{task?.id !== 0 && <StatusBadge status={form.status} />}<Separator /><div className="space-y-2"><Label htmlFor="task-name">Task name</Label><Input id="task-name" value={form.name} onChange={(event) => setField("name", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" value={form.description} onChange={(event) => setField("description", event.target.value)} /></div><div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="task-enabled">Enable task</Label><p className="text-xs text-muted-foreground">Updates the persisted automation status.</p></div><Switch id="task-enabled" checked={form.status === "Enabled"} onCheckedChange={(checked) => setField("status", checked ? "Enabled" : "Disabled")} /></div><div className="space-y-2"><Label>Frequency</Label><Select value={form.frequency} onValueChange={(value) => setField("frequency", value as Frequency)}><SelectTrigger className="w-full"><SelectValue placeholder="Choose frequency" /></SelectTrigger><SelectContent>{Object.entries(frequencyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>{form.frequency === "daily" && <div className="space-y-2"><Label>Daily execution time</Label><Input type="time" value={form.dailyTime || "02:00"} onChange={(event) => setField("dailyTime", event.target.value)} /></div>}<div className="space-y-2"><Label htmlFor="task-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="task-notes" value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!form.name.trim() || !form.description.trim() || isSaving} onClick={() => onSave(form)}>Save Changes</Button></DialogFooter></DialogContent></Dialog>;
}
