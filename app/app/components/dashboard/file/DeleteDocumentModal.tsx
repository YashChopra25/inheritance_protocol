import { FC } from "react";
import { AlertTriangle } from "lucide-react";
import { TxButton } from "../shared/ui";
import { DocumentDialog } from "./DocumentDialog";

interface DeleteDocumentModalProps {
  cid: string;
  isActive: boolean;
  /** Removes the on-chain reference, then unpins (see `useDocumentActions`). */
  onRemove: () => Promise<string>;
  onClose: () => void;
  refresh: () => void;
}

export const DeleteDocumentModal: FC<DeleteDocumentModalProps> = ({
  cid,
  isActive,
  onRemove,
  onClose,
  refresh,
}) => (
  <DocumentDialog title="Delete Document" subtitle={`CID: ${cid}`} onClose={onClose}>
    <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 p-4 text-[10px] text-muted leading-relaxed flex gap-2.5 items-start">
      <AlertTriangle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" aria-hidden />
      <div>
        <strong className="text-[var(--danger)] font-semibold uppercase block mb-0.5">Warning</strong>
        This removes the document from your will on-chain and deletes its
        encrypted copy from storage. Your heirs will no longer be able to open
        it. This cannot be undone.
      </div>
    </div>
    <div className="flex items-center justify-end gap-2.5 pt-2">
      <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-xs font-semibold hover:bg-white/5 text-foreground transition-colors cursor-pointer">Cancel</button>
      <TxButton
        tone="danger"
        action={onRemove}
        onDone={() => { onClose(); refresh(); }}
        disabled={!isActive}
      >
        Confirm Delete
      </TxButton>
    </div>
  </DocumentDialog>
);
