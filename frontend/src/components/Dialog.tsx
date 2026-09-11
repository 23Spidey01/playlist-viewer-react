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

  // Escape always cancels, regardless of which control has focus.
  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (request.kind === "confirm") request.resolve(false);
      else request.resolve(null);
      setRequest(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request]);

  // Autofocus the input (prompt) or the primary button (confirm).
  useEffect(() => {
    if (!request) return;
    const t = setTimeout(() => {
      if (request.kind === "prompt") inputRef.current?.focus();
      else okButtonRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [request]);

  if (!request) return null;

  const handleCancel = () => {
    if (request.kind === "confirm") request.resolve(false);
    else request.resolve(null);
    setRequest(null);
  };

  const handleConfirm = () => {
    if (request.kind === "confirm") request.resolve(true);
    else request.resolve(value);
    setRequest(null);
  };

  return createPortal(
    <div className="pixel-dialog-overlay" onClick={handleCancel}>
      <div className="pixel-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pixel-font text-[10px] text-cyan-300 pixel-dialog-title">
          {request.kind === "confirm" ? "CONFIRM" : "ENTER VALUE"}
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
          <button className="pixel-tab" onClick={handleCancel}>
            {request.cancelLabel}
          </button>
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
