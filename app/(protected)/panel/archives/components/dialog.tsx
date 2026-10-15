"use client";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";

import { Loader2 } from "lucide-react";
import { request, requestWithErrorHandling } from "@/components/http";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { useArchive } from "../provider";

export default function ArchiveDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const { archivesQuery, selected, setSelected } = useArchive();

  async function onRestore() {
    requestWithErrorHandling(
      await request("PUT", `/api/archives/${selected?.archived_id}/restore`),
      null,
      (result) => {
        console.log("Archive restored successfully:", result);
        archivesQuery.refetch();

        dispatch({
          type: "CLOSE",
        });

        send({
          type: "ARCHIVE_RESTORED",
          payload: [
            Number(selected.archived_id),
            Number(selected.entity_id),
            selected.entity_table,
          ],
        });
      },
    );
  }

  return (
    <>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>

        {!state.isOpen ? (
          <Loader2
            className="mx-auto size-6 animate-spin"
            aria-label="Loading"
          />
        ) : state.mode === DialogMode.DEFAULT && state.isOpen ? (
          <>
            <pre>
              {JSON.stringify(
                archivesQuery.data?.rows.find(
                  (row) => row.id === selected.archived_id,
                ),
                null,
                2,
              )}
            </pre>
          </>
        ) : (
          state.mode === DialogMode.ARCHIVE &&
          state.isOpen && (
            <>
              <form
                id="form"
                onSubmit={(event) => {
                  event.preventDefault();

                  onRestore();
                }}
              ></form>
            </>
          )
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline">
                Cancel
              </Button>
            }
          />
          {state.action !== "none" && (
            <Button
              variant={"default"}
              disabled={!state.isOpen}
              type="submit"
              form="form"
            >
              {state.action}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </>
  );
}
