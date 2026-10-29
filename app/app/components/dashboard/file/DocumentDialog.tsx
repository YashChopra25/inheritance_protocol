"use client";

import { FC, ReactNode } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

interface DocumentDialogProps {
  title: ReactNode;
  /** Secondary line under the title; also the dialog's accessible description. */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Width class for the panel. */
  widthClass?: string;
}

/**
 * Accessible modal shell for the document dialogs: `role="dialog"` with
 * `aria-modal`, labelled by its title, focus trapped inside and restored on
 * close, Escape and overlay click to dismiss. Rendered in a portal, so it is
 * safe to open from inside a table row.
 */
export const DocumentDialog: FC<DocumentDialogProps> = ({
  title,
  subtitle,
  onClose,
  children,
  widthClass = "max-w-md",
}) => (
  <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <Dialog.Content
        className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] ${widthClass} -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface p-6 space-y-5 text-left focus:outline-none`}
        {...(subtitle ? {} : { "aria-describedby": undefined })}
      >
        <Dialog.Close
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 text-muted hover:text-foreground hover:bg-white/[0.04] rounded-lg transition-all cursor-pointer"
        >
          <X className="size-4" />
        </Dialog.Close>
        <div className="pr-8">
          <Dialog.Title className="text-sm font-semibold text-foreground">
            {title}
          </Dialog.Title>
          {subtitle && (
            <Dialog.Description className="text-[10px] text-muted mt-0.5 font-mono break-all">
              {subtitle}
            </Dialog.Description>
          )}
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
