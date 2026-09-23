// Dialog.tsx — renders the pixel-styled modal for window.prompt()/
// confirm() replacements. Mount <DialogHost /> once near the app
// root; everywhere else, call the functions from ./dialogStore
// (askApiKey, confirmDialog, promptText) — no hook/context needed.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DialogRequest } from "./dialogStore";
import { setDialogHandler } from "./dialogStore";
import "./pixel-ui.css";

export const DialogHost: React.FC = () => {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const okButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDialogHandler((req) => {
      setRequest(req);
      setValue("");
    });
    return () => setDialogHandler(null);
  }, []);

  // Escape always dismisses, regardless of which control has focus —
  // "cancel" for confirm/prompt, but alert has nothing to cancel, so
  // it just resolves the same way its own OK button would.
  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (request.kind === "confirm") request.resolve(false);
      else if (request.kind === "alert") request.resolve();
      else request.resolve(null);
      setRequest(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request]);

  // Autofocus the input (prompt) or the primary button (confirm/alert).
  useEffect(() => {
    if (!request) return;
    const t = setTimeout(() => {
      if (request.kind === "prompt") inputRef.current?.focus();
      else okButtonRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [request]);

  if (!request) return null;

  // Clicking the dim overlay behind the dialog dismisses it the same
  // way Escape does — for alert there's no real "cancel" distinct from
  // "OK", so both just resolve it.
  const handleCancel = () => {
    if (request.kind === "confirm") request.resolve(false);
    else if (request.kind === "alert") request.resolve();
    else request.resolve(null);
    setRequest(null);
  };

  const handleConfirm = () => {
    if (request.kind === "confirm") request.resolve(true);
    else if (request.kind === "alert") request.resolve();
    else request.resolve(value);
    setRequest(null);
  };

  return createPortal(
    <div className="pixel-dialog-overlay" onClick={handleCancel}>
      <div className="pixel-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pixel-font text-[10px] text-cyan-300 pixel-dialog-title">
          {request.kind === "confirm"
            ? "CONFIRM"
            : request.kind === "alert"
              ? "NOTICE"
              : "ENTER VALUE"}
        </div>
        <div className="pixel-dialog-message">{request.message}</div>
        {request.kind === "prompt" && (
          <input
            ref={inputRef}
            type="text"
            className="pixel-input w-full"
            placeholder={request.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
        )}
        <div className="pixel-dialog-actions">
          {/* alert has nothing to cancel — just the one dismiss button. */}
          {request.kind !== "alert" && (
            <button className="pixel-tab" onClick={handleCancel}>
              {request.cancelLabel}
            </button>
          )}
          <button
            ref={okButtonRef}
            className={`pixel-btn${
              request.kind === "confirm" && request.danger ? " danger" : ""
            }`}
            onClick={handleConfirm}
          >
            {request.okLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
