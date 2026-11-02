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
import { useWarehouses } from "../provider";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { request, requestWithErrorHandling } from "@/components/http";
import { useWebSocket } from "@/components/providers/websocket-provider";
import Form from "./form";
import { useWatch } from "react-hook-form";
import { Map, MapMarker, MapRef, MarkerContent } from "@/components/ui/map";

export default function WarehouseDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const { form, warehouseQuery, warehouseDetailQuery, selected, mapRef, latitude, longitude } =
    useWarehouses();

  const [pending, setPending] = useState(false);
  const point = useWatch({ control: form.control, name: ["longitude", "latitude"] });
  const hasPoint = point.every((value) => typeof value === "number" && Number.isFinite(value));
  useEffect(() => { if (state.isOpen) form.clearErrors(); }, [state.isOpen, state.mode, selected.id, form]);

  async function onDelete() {
    await requestWithErrorHandling(
      await request(
        "DELETE",
        `/api/warehouses/${selected.id}?version=${selected.version}`,
      ),
      form,
      (_) => {
        warehouseQuery.refetch();

        dispatch({
          type: "CLOSE",
        });

        send({
          type: "WAREHOUSE_DELETED",
          payload: [selected.id],
        });
      },
    );
  }

  async function onArchive() {
    await requestWithErrorHandling(
      await request(
        "POST",
        `/api/warehouses/${selected.id}/archive?version=${selected.version}`,
      ),
      form,
      (result) => {
        warehouseQuery.refetch();
        dispatch({
          type: "CLOSE",
        });

        send({
          type: "WAREHOUSE_ARCHIVED",
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
      <DialogContent className={`${getModalSize()} max-h-[90dvh] overflow-y-auto`}>
        {!state.isOpen ? (
          <Loader2
            className="mx-auto size-6 animate-spin"
            aria-label="Loading"
          />
        ) : ![DialogMode.ARCHIVE, DialogMode.DELETE].includes(state.mode) &&
          state.isOpen ? (
          <div className="grid md:grid-cols-2">
            <div className="relative h-48 bg-muted md:h-auto md:min-h-130">
              {!hasPoint && <p role="status" className="absolute z-10 bg-background p-2 text-xs">No coordinates selected. Enter coordinates manually if map search is unavailable.</p>}
              <Map ref={mapRef} center={[longitude, latitude]} zoom={16}>
                {hasPoint && <MapMarker longitude={point[0]!} latitude={point[1]!}>
                  <MarkerContent>
                    <div className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-primary shadow-lg" />
                  </MarkerContent>
                </MapMarker>}
              </Map>
            </div>

            <div className="flex flex-col sm:p-5">
              <DialogHeader className="mb-6">
                <DialogTitle>{state.mode === DialogMode.EDIT ? "Edit Warehouse" : "Create Warehouse"}</DialogTitle>
                <DialogDescription>
                  Enter the warehouse location details below.
                </DialogDescription>
              </DialogHeader>
              <Form />
            </div>
          </div>
        ) : (
          [DialogMode.ARCHIVE, DialogMode.DELETE].includes(state.mode) &&
          state.isOpen && (
            <>
              <DialogHeader>
                <DialogTitle>{state.title}</DialogTitle>
                <DialogDescription>{state.description}</DialogDescription>
              </DialogHeader>
              <form
                id="form"
                onSubmit={(event) => {
                  event.preventDefault();

                  if (state.mode === DialogMode.DELETE) {
                    if (pending) return; setPending(true); void onDelete().finally(() => setPending(false));
                  } else {
                    if (pending) return; setPending(true); void onArchive().finally(() => setPending(false));
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
          <Button
            variant={
              state.mode === DialogMode.DELETE ||
              state.mode === DialogMode.ARCHIVE
                ? "destructive"
                : "default"
            }
            disabled={(state.mode === DialogMode.EDIT && (warehouseDetailQuery.isFetching || warehouseDetailQuery.isError || !warehouseDetailQuery.data)) || !state.isOpen || pending || form.formState.isSubmitting}
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
