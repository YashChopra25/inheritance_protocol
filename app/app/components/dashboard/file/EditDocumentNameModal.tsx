import { FC, useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useDocumentActions } from "@/hooks/useDocumentActions";
import { DocumentDialog } from "./DocumentDialog";

interface EditDocumentNameModalProps {
  cid: string;
  fileName: string;
  onClose: () => void;
}

export const EditDocumentNameModal: FC<EditDocumentNameModalProps> = ({
  cid,
  fileName,
  onClose,
}) => {
  const [newName, setNewName] = useState("");
  const [updating, setUpdating] = useState(false);
  const { renameDocument } = useDocumentActions();
  const inputId = useId();

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setUpdating(true);
    const toastId = toast.loading("Updating document label…");
    try {
      await renameDocument(cid, newName.trim());
      toast.success("Document label updated", { id: toastId });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      toast.error(msg, { id: toastId });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <DocumentDialog title="Edit Document Label" subtitle={`CID: ${cid}`} onClose={onClose}>
      <div className="rounded-xl border border-[var(--warn)]/20 bg-[var(--warn)]/5 p-4 text-[10px] text-muted leading-relaxed flex gap-2.5 items-start">
        <AlertTriangle className="size-4 text-[var(--warn)] shrink-0 mt-0.5" aria-hidden />
        <div>
          <strong className="text-[var(--warn)] font-semibold uppercase block mb-0.5">Not encrypted</strong>
          This label helps you find the document in your list. Unlike the
          document itself and its real filename, the label is stored unencrypted
          with the storage provider — don&apos;t put anything sensitive in it.
        </div>
      </div>
      <form
        className="space-y-5"
        onSubmit={(e) => { e.preventDefault(); void handleSaveName(); }}
      >
        <div className="space-y-1.5">
          <label htmlFor={inputId} className="text-[10px] text-muted font-medium">New label</label>
          <input id={inputId} type="text" maxLength={128} value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full h-9 bg-black/40 border border-border rounded-lg px-3 text-xs text-foreground focus:outline-none focus:border-[var(--accent)]/50 transition-colors" placeholder={fileName} />
        </div>
        <div className="flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-xs font-semibold hover:bg-white/5 text-foreground transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={updating || !newName.trim() || newName.trim() === fileName} className="h-9 px-4 rounded-lg text-xs font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">{updating ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </DocumentDialog>
  );
};
