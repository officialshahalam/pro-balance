"use client";
import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

let resolveRef: ((value: boolean) => void) | null = null;
let setStateRef: ((opts: ConfirmOptions & { open: boolean }) => void) | null = null;

export function confirm(opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    resolveRef = resolve;
    setStateRef?.({ ...opts, open: true });
  });
}

export function ConfirmDialogProvider() {
  const [state, setState] = useState<ConfirmOptions & { open: boolean }>({ open: false });
  setStateRef = setState;

  const handleClose = useCallback((result: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolveRef?.(result);
    resolveRef = null;
  }, []);

  return (
    <Dialog open={state.open} onOpenChange={(open) => { if (!open) handleClose(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{state.title || "Are you sure?"}</DialogTitle>
        </DialogHeader>
        {state.description && (
          <p className="text-sm text-muted-foreground">{state.description}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
            {state.cancelLabel || "Cancel"}
          </Button>
          <Button
            variant={state.destructive ? "destructive" : "default"}
            size="sm"
            onClick={() => handleClose(true)}
          >
            {state.confirmLabel || "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
