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
import { Map, MapMarker, MapRef, MarkerContent } from "@/components/ui/map";

export default function WarehouseDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const { form, warehouseQuery, selected, mapRef, latitude, longitude } =
    useWarehouses();

  async function onDelete() {
    requestWithErrorHandling(
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
    console.log(
      "Archiving warehouse with ID:",
      selected.id,
      "and version:",
      selected.version,
    );
    requestWithErrorHandling(
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
      <DialogContent className={getModalSize()}>
        {!state.isOpen ? (
          <Loader2
            className="mx-auto size-6 animate-spin"
            aria-label="Loading"
          />
        ) : ![DialogMode.ARCHIVE, DialogMode.DELETE].includes(state.mode) &&
          state.isOpen ? (
          <div className="grid md:grid-cols-2">
            <div className="relative hidden min-h-130 bg-muted md:block">
              <Map ref={mapRef} center={[longitude, latitude]} zoom={16}>
                <MapMarker longitude={longitude} latitude={latitude}>
                  <MarkerContent>
                    <div className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-primary shadow-lg" />
                  </MarkerContent>
                </MapMarker>
              </Map>
            </div>

            <div className="flex flex-col sm:p-5">
              <DialogHeader className="mb-6">
                <DialogTitle>Create Product</DialogTitle>
                <DialogDescription>
                  Enter the product information below.
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
