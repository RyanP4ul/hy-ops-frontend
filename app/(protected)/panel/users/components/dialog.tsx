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
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { request, requestWithErrorHandling } from "@/components/http";
import { useWebSocket } from "@/components/providers/websocket-provider";
import Form from "./form";
import ChangePasswordForm from "./change-password-form";

export default function UserDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const { form, userQuery, userDetailQuery, selected } = useUser();

  const [pending, setPending] = useState(false);
  useEffect(() => { if (state.isOpen) form.clearErrors(); }, [state.isOpen, state.mode, selected.id, form]);

  async function onDelete() {
    await requestWithErrorHandling(
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
    await requestWithErrorHandling(
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
        ) : state.mode === DialogMode.CHANGE_PASSWORD ? (
          <ChangePasswordForm />
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
                    if (pending) return;
                    setPending(true);
                    void onDelete().finally(() => setPending(false));
                  } else {
                    if (pending) return;
                    setPending(true);
                    void onArchive().finally(() => setPending(false));
                  }
                }}
              ></form>
            </>
          )
        )}

        {form.formState.errors.root?.message && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline">
                Cancel
              </Button>
            }
          />
          {state.mode !== DialogMode.CHANGE_PASSWORD && <Button
            variant={
              state.mode === DialogMode.DELETE ||
              state.mode === DialogMode.ARCHIVE
                ? "destructive"
                : "default"
            }
            disabled={(state.mode === DialogMode.EDIT && (userDetailQuery.isFetching || userDetailQuery.isError || !userDetailQuery.data)) || !state.isOpen || pending || form.formState.isSubmitting}
            type="submit"
            form="form"
          >
            {pending || form.formState.isSubmitting ? "Saving..." : state.action}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </>
  );
}
