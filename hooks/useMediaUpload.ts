import { useState } from "react";
import { toast } from "sonner";
import { useVault } from "./useVault";

interface UseMediaUploadProps {
  mediaIndex: number;
  refresh: () => void;
  isActive: boolean;
}

export function useMediaUpload({ mediaIndex, refresh, isActive }: UseMediaUploadProps) {
  const vault = useVault();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  async function onUpload() {
    if (!selectedFile) {
      setError("Choose a file first");
      return;
    }
    setBusy(true);
    setError(null);
    setUploadProgress(0);
    const toastId = toast.loading("Preparing document upload...");
    
    try {
      const json = await new Promise<{ cid: string; mediaType?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/ipfs/upload");
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 45);
            setUploadProgress(percent);
            toast.loading(`Uploading "${selectedFile.name}" to IPFS (${percent}%)...`, { id: toastId });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid response from upload server"));
            }
          } else {
            try {
              const errJson = JSON.parse(xhr.responseText);
              reject(new Error(errJson.error ?? `Upload failed with status ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        
        const fd = new FormData();
        fd.append("file", selectedFile);
        xhr.send(fd);
      });

      setUploadProgress(60);
      toast.loading("Sending transaction to Solana... Please sign in your wallet", { id: toastId });
      
      const interval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 5 : prev));
      }, 800);

      try {
        await vault.addMedia(json.cid, json.mediaType || "application/octet-stream", mediaIndex);
      } finally {
        clearInterval(interval);
      }

      setUploadProgress(100);
      toast.success(`"${selectedFile.name}" uploaded and sealed successfully on-chain!`, { id: toastId });
      setSelectedFile(null);
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg, { id: toastId });
      setError(msg);
      setUploadProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return {
    selectedFile,
    setSelectedFile,
    busy,
    error,
    uploadProgress,
    onUpload,
  };
}
