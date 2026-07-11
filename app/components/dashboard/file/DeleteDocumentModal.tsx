import { FC } from "react";
import { X, AlertTriangle } from "lucide-react";
import { TxButton } from "../shared/ui";

interface DeleteDocumentModalProps {
  cid: string;
  mediaIndex: number;
  isActive: boolean;
  onRemove: (index: number) => Promise<string>;
  onClose: () => void;
  refresh: () => void;
}

export const DeleteDocumentModal: FC<DeleteDocumentModalProps> = ({
  cid,
  mediaIndex,
  isActive,
  onRemove,
  onClose,
  refresh,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0e0a1c] p-6 glass-strong shadow-2xl space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-muted hover:text-white hover:bg-white/[0.04] rounded-lg transition-all"><X className="size-4" /></button>
        <div>
          <h3 className="text-sm font-semibold text-white">Delete Document</h3>
          <p className="text-[10px] text-muted mt-0.5 font-mono">CID: {cid}</p>
        </div>
        <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 p-4 text-[10px] text-muted leading-relaxed flex gap-2.5 items-start">
          <AlertTriangle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[var(--danger)] font-semibold uppercase block mb-0.5">Warning</strong>
            This will permanently unseal and delete the document reference from your inheritance vault on the Solana blockchain.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-xs font-semibold hover:bg-white/5 text-white transition-colors cursor-pointer">Cancel</button>
          <TxButton
            tone="danger"
            action={async () => {
              const sig = await onRemove(mediaIndex);
              fetch("/api/ipfs/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cid }),
              }).catch((err) => console.error("Background Pinata delete failed:", err));
              return sig;
            }}
            onDone={() => { onClose(); refresh(); }}
            disabled={!isActive}
          >
            Confirm Delete
          </TxButton>
        </div>
      </div>
    </div>
  );
};
