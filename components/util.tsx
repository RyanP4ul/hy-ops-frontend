import { FieldErrors } from "react-hook-form";
import { toast } from "sonner";

const isDebugMode = process.env.NEXT_PUBLIC_DEBUG === "true";

export function ToastSubmit(data: any) {
  if (!isDebugMode) return;

  toast("You submitted the following values:", {
    description: (
      <pre className="mt-2 w-[320px] overflow-x-auto rounded-md bg-code p-4 text-code-foreground">
        <code>{JSON.stringify(data, null, 2)}</code>
      </pre>
    ),
    position: "bottom-right",
    classNames: {
      content: "flex flex-col gap-2",
    },
    style: {
      "--border-radius": "calc(var(--radius)  + 4px)",
    } as React.CSSProperties,
  });
}

export function ToastValidationError(error: FieldErrors) {
  if (!isDebugMode) return;

  toast("Validation Error:", {
    description: (
      <pre className="mt-2 w-[320px] overflow-x-auto rounded-md bg-code p-4 text-code-foreground">
        <code>{JSON.stringify(error, null, 2)}</code>
      </pre>
    ),
    position: "bottom-right",
    classNames: {
      content: "flex flex-col gap-2",
    },
    style: {
      "--border-radius": "calc(var(--radius)  + 4px)",
    } as React.CSSProperties,
  });
}
