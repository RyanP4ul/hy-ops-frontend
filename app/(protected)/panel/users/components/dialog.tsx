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
import { useUser } from "../provider";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { request, requestWithErrorHandling } from "@/components/http";
import { useWebSocket } from "@/components/providers/websocket-provider";
import Form from "./form";

export default function UserDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const { form, userQuery, selected } = useUser();

  async function onDelete() {
    requestWithErrorHandling(
      await request(
        "DELETE",
        `/api/users/${selected.id}?version=${selected.version}`,
      ),
      form,
      (_) => {
        userQuery.refetch();

        dispatch({
          type: "CLOSE",
        });

        send({
          type: "USER_DELETED",
          payload: [selected.id],
        });
      },
    );
  }

  async function onArchive() {
    requestWithErrorHandling(
      await request(
        "POST",
        `/api/users/${selected.id}/archive?version=${selected.version}`,
      ),
      form,
      (result) => {
        userQuery.refetch();
        dispatch({
          type: "CLOSE",
        });

        send({
          type: "USER_ARCHIVED",
          payload: [result.id, selected.id],
        });
      },
    );
  }

  const getModalSize = () => {
    switch (state.mode) {
      case DialogMode.ARCHIVE:
      case DialogMode.DELETE:
        return "sm:max-w-md";
      case DialogMode.CUSTOM:
        return "sm:max-w-3xl";
      default:
        return "sm:max-w-5xl";
    }
  };

  return (
    <>
      <DialogContent className={getModalSize()}>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>

        {!state.isOpen ? (
          <Loader2
            className="mx-auto size-6 animate-spin"
            aria-label="Loading"
          />
        ) : ![DialogMode.ARCHIVE, DialogMode.DELETE].includes(state.mode) &&
          state.isOpen ? (
          <Form />
        ) : (
          [DialogMode.ARCHIVE, DialogMode.DELETE].includes(state.mode) &&
          state.isOpen && (
            <>
              <form
                id="form"
                onSubmit={(event) => {
                  event.preventDefault();

                  if (state.mode === DialogMode.DELETE) {
                    onDelete();
                  } else {
                    onArchive();
                  }
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
          <Button
            variant={
              state.mode === DialogMode.DELETE ||
              state.mode === DialogMode.ARCHIVE
                ? "destructive"
                : "default"
            }
            disabled={!state.isOpen}
            type="submit"
            form="form"
          >
            {state.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  );
}
