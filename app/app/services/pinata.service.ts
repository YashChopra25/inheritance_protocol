import { PinataFileMetadata } from "../types/pinata.types";

/**
 * Client for the `/api/ipfs/*` routes. Every route requires a wallet session,
 * so callers sign in first (see `useVaultSession`); a 401 here means they did
 * not.
 */

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const json = await res.json().catch(() => ({}));
  return new Error(json.error || `${fallback} (${res.status})`);
}

export async function fetchPinataMetadata(cid: string): Promise<PinataFileMetadata> {
  const res = await fetch(`/api/ipfs/metadata?cid=${encodeURIComponent(cid)}`, {
    credentials: "same-origin",
  });
  if (!res.ok) throw await errorFrom(res, "Failed to load metadata");
  return res.json();
}

/** Unpin a document. Idempotent: an already-removed pin reports success. */
export async function unpinDocument(cid: string): Promise<void> {
  const res = await fetch("/api/ipfs/delete", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cid }),
  });
  if (!res.ok) throw await errorFrom(res, "Could not unpin the document");
}

/** Set the operator-visible pin label (NOT the encrypted real filename). */
export async function renamePin(cid: string, name: string): Promise<void> {
  const res = await fetch("/api/ipfs/update", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cid, name }),
  });
  if (!res.ok) throw await errorFrom(res, "Update failed");
}

/** Fetch a sealed container. Bytes are ciphertext; the caller unseals them. */
export async function fetchSealedContainer(cid: string): Promise<Uint8Array> {
  const res = await fetch(`/api/ipfs/retrieve?cid=${encodeURIComponent(cid)}`, {
    credentials: "same-origin",
  });
  if (!res.ok) throw await errorFrom(res, "Could not load document");
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Upload an already-sealed container. XHR rather than fetch because fetch
 * cannot report upload progress; `onProgress` receives a 0..1 fraction.
 *
 * The file is sent under a fixed, uninformative name: the pin label is visible
 * to the pinning provider, and the real filename lives inside the container.
 */
export function uploadSealedContainer(
  sealed: Uint8Array,
  onProgress?: (fraction: number) => void
): Promise<{ cid: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/ipfs/upload");
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };

    xhr.onload = () => {
      let json: { cid?: string; error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // handled below
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.cid) {
        resolve({ cid: json.cid });
      } else {
        reject(
          new Error(json.error ?? `Upload failed with status ${xhr.status}`)
        );
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));

    const fd = new FormData();
    fd.append(
      "file",
      new File([sealed as BlobPart], "sealed.vseal", {
        type: "application/octet-stream",
      })
    );
    xhr.send(fd);
  });
}
