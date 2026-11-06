"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, DatabaseBackup, ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/components/http";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type BackupSchedule = {
  enabled: boolean;
  daily_time: string;
  timezone: string;
  next_run_at: string | null;
  last_requested_at: string | null;
  last_error: string | null;
  updated_at: string;
  configured: boolean;
  scheduler_running: boolean;
  workflow_url: string | null;
};
type Draft = Pick<BackupSchedule, "enabled" | "daily_time" | "updated_at">;
const queryKey = ["backup-schedule"];

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || "Unable to update the backup schedule. Please try again.");
  return result as T;
}

function formatTime(value: string | null) {
  if (!value) return "Not yet requested";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}

export default function TabBackup() {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const query = useQuery({
    queryKey,
    queryFn: async () => readResponse<BackupSchedule>(await request("GET", "/api/automations/backup-schedule")),
    refetchInterval: 30000,
  });
  const save = useMutation({
    mutationFn: async (values: Draft) => readResponse<BackupSchedule>(await request("PUT", "/api/automations/backup-schedule", values)),
    onSuccess: data => {
      client.setQueryData(queryKey, data);
      setDraft(null);
      toast.success("Backup schedule saved");
    },
  });
  const run = useMutation({
    mutationFn: async () => readResponse<{ message: string }>(await request("POST", "/api/automations/backup-schedule/run")),
    onSuccess: data => toast.success(data.message),
    onSettled: () => void client.invalidateQueries({ queryKey }),
  });
  const data = query.data;
  const values = draft ?? data;
  const dirty = Boolean(data && draft && (draft.enabled !== data.enabled || draft.daily_time !== data.daily_time));
  const busy = save.isPending || run.isPending;
  function edit(change: Partial<Draft>) {
    if (values) setDraft({ enabled: values.enabled, daily_time: values.daily_time, updated_at: values.updated_at, ...change });
    save.reset();
  }

  return (
    <Card id="github-backup-schedule">
      <CardHeader className="gap-3 border-b sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><DatabaseBackup className="size-5" aria-hidden="true" /></div>
          <div className="space-y-1"><CardTitle><h2>Database backup</h2></CardTitle><CardDescription>Choose when to request your Supabase backup on GitHub Actions.</CardDescription></div>
        </div>
        {data && <Badge variant={data.enabled ? "default" : "secondary"}>{data.enabled ? "Scheduled daily" : "Paused"}</Badge>}
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isPending ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading backup schedule…</p>
          : !data ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">Unable to load the backup schedule.</p><Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>Try again</Button></div>
          : values && <>
            {!data.configured && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">The GitHub connection needs server setup before backups can run. You can still save your preferred time.</p>}
            {data.configured && !data.scheduler_running && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">The automatic scheduler is stopped. Your backend must be running with automations enabled for scheduled requests.</p>}
            <form onSubmit={event => { event.preventDefault(); if (dirty && !busy) save.mutate({ enabled: values.enabled, daily_time: values.daily_time, updated_at: values.updated_at }); }} className="space-y-5">
              <fieldset disabled={busy} className="min-w-0 space-y-5">
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div><Label htmlFor="backup-enabled">Automatic daily backup</Label><p id="backup-enabled-description" className="mt-1 text-sm text-muted-foreground">Request one backup each day at your saved time.</p></div>
                  <Switch id="backup-enabled" checked={values.enabled} onCheckedChange={enabled => edit({ enabled })} disabled={busy || (!data.configured && !values.enabled)} aria-describedby="backup-enabled-description" />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="backup-daily-time">Daily backup time</Label><Input id="backup-daily-time" type="time" step={60} required value={values.daily_time} onChange={event => edit({ daily_time: event.target.value })} className="h-11 sm:max-w-64" aria-describedby="backup-time-help" /><p id="backup-time-help" className="text-xs text-muted-foreground">Philippine time · Asia/Manila (UTC+08:00)</p></div>
                  <div className="rounded-lg bg-muted/50 p-4 text-sm"><div className="mb-1 flex items-center gap-2 font-medium"><Clock3 className="size-4" aria-hidden="true" />Next scheduled request</div><p>{data.enabled && data.next_run_at ? formatTime(data.next_run_at) : "Paused"}</p><p className="mt-1 text-xs text-muted-foreground">{dirty ? "Save your changes to update the schedule." : "Times shown in Philippine time."}</p></div>
                </div>
              </fieldset>
              {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p role="status" className="text-sm text-muted-foreground">{save.isPending ? "Saving schedule…" : dirty ? "You have unsaved changes" : "Schedule is up to date"}</p>
                <div className="flex gap-2"><Button type="button" variant="ghost" disabled={!draft || busy} onClick={() => { setDraft(null); save.reset(); }}>Discard</Button><Button type="submit" disabled={!dirty || busy || !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.daily_time)}><Save aria-hidden="true" />Save schedule</Button></div>
              </div>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted/50 p-4">
              <div className="space-y-1"><p className="text-sm font-medium">Last request attempt: {formatTime(data.last_requested_at)}</p><p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">GitHub may queue the run. A request does not confirm a completed backup; check the workflow for its result. Manual requests use the saved configuration and leave your daily schedule unchanged.</p></div>
              <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!data.configured || busy} onClick={() => run.mutate()}>{run.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}Back up now</Button>{data.workflow_url && <Button nativeButton={false} variant="ghost" render={<a href={data.workflow_url} target="_blank" rel="noopener noreferrer" />}>View workflow<ExternalLink aria-hidden="true" /></Button>}</div>
            </div>
            {(run.error || data.last_error) && <p role="alert" className="text-sm text-destructive">{run.error?.message ?? data.last_error}</p>}
          </>}
      </CardContent>
    </Card>
  );
}
