"use client";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Loader2, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import {
  productSchema,
  ProductType,
  ProductVariantType,
} from "@/schema/product";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useProducts } from "../provider";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useModal } from "@/components/providers/modal-provider";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import { DialogMode } from "@/types/dialog";
import { useWebSocket } from "@/components/providers/websocket-provider";
import Form from "./form";

export default function DialogPage() {
  const { state, dispatch } = useModal();
  const { deleteProduct, selected } = useProducts();

  async function onDelete() {
    try {
      await deleteProduct.mutateAsync({
        id: selected.id,
        version: selected.version,
      } as ProductType);

      dispatch({
        type: "CLOSE",
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(
          error.message || "An error occurred while deleting the product.",
        );
      }
    }
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
        ) : state.mode !== DialogMode.DELETE && state.isOpen ? (
          <Form />
        ) : (
          state.mode === DialogMode.DELETE &&
          state.isOpen && (
            <>
              <form
                id="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  onDelete();
                  dispatch({
                    type: "CLOSE",
                  });
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
              state.mode === DialogMode.DELETE ? "destructive" : "default"
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
