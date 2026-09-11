// dialogStore.ts — pixel-styled replacement for window.prompt()/confirm().
// Split from Dialog.tsx (which mounts <DialogHost /> and must only
// export a component, for Fast Refresh) so these plain functions can
// be imported anywhere:
//   const key = await askApiKey();
//   const ok = await confirmDialog("Are you sure?");
//   const isAutomatic = await confirmDialog("Automatic or manual?", {
//     okLabel: "Automatic", cancelLabel: "Manual",
//   });
//   const rating = await promptText("Star rating?", { placeholder: "8.5" });
// Each resolves the same way the native dialog would: null/false on
// cancel or Escape, the entered/confirmed value otherwise.

export interface ConfirmOptions {
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions {
  placeholder?: string;
  defaultValue?: string;
  okLabel?: string;
  cancelLabel?: string;
}

export type DialogRequest =
  | {
      kind: "confirm";
      message: string;
      okLabel: string;
      cancelLabel: string;
      danger: boolean;
      resolve: (v: boolean) => void;
    }
  | {
      kind: "prompt";
      message: string;
      placeholder: string;
      okLabel: string;
      cancelLabel: string;
      resolve: (v: string | null) => void;
    };

// Set by the single mounted <DialogHost />. Calling the exported
// functions before it mounts (or after it unmounts) resolves the
// "cancelled" value instead of throwing.
let openDialog: ((req: DialogRequest) => void) | null = null;

export function setDialogHandler(handler: ((req: DialogRequest) => void) | null) {
  openDialog = handler;
}

export function confirmDialog(
  message: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!openDialog) return resolve(false);
    openDialog({
      kind: "confirm",
      message,
      okLabel: options.okLabel ?? "OK",
      cancelLabel: options.cancelLabel ?? "Cancel",
      danger: options.danger ?? false,
      resolve,
    });
  });
}

export function promptText(
  message: string,
  options: PromptOptions = {},
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!openDialog) return resolve(null);
    openDialog({
      kind: "prompt",
      message,
      placeholder: options.placeholder ?? "",
      okLabel: options.okLabel ?? "OK",
      cancelLabel: options.cancelLabel ?? "Cancel",
      resolve,
    });
  });
}

// Convenience wrapper for the recurring "enter the API key" prompt.
export function askApiKey(): Promise<string | null> {
  return promptText("Please enter the API key for this pool:", {
    placeholder: "API key",
    okLabel: "Confirm",
  });
}
