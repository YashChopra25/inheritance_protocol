"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { isSealed, unsealFile } from "@/lib/crypto";
import { useVaultIdentity, useVaultSession } from "./useVaultSession";
import { fetchSealedContainer } from "@/app/services/pinata.service";
import { checkCid } from "@/lib/cid";

/**
 * Fetch a vault document and open it in the browser.
 *
 * The server hands back ciphertext and nothing else (C5), so the decryption
 * happens here, under a key derived from the viewer's own wallet. A viewer who
 * is not a recipient gets a clear "not sealed to you" message rather than a
 * blank frame — that is an expected outcome for an heir who has not been named,
 * not an error state.
 *
 * The real filename and MIME type come out of the sealed container, not from
 * the server or the chain, because both of those are public.
 */

interface MediaContent {
  objectUrl: string | null;
  textPreview: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
}

const EMPTY: MediaContent = {
  objectUrl: null,
  textPreview: null,
  fileName: null,
  mimeType: null,
  fileSize: null,
};

function isTextual(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("xml") ||
    mime.includes("markdown")
  );
}

export function useMediaContent(cid: string) {
  const session = useVaultSession();
  const { unlock, wallet } = useVaultIdentity();
  // Object URLs are revoked when a new one replaces them and when the viewer
  // unmounts, so a decrypted document never outlives the preview showing it.
  const urlRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    },
    []
  );

  const load = useCallback(async (): Promise<MediaContent> => {
    if (!wallet) throw new Error("Connect a wallet to view this document");

    // The retrieve route is authenticated and authorizes against the chain.
    if (!session.signedIn) await session.signIn();

    const container = await fetchSealedContainer(cid);
    // The CID came from the chain; the bytes came through our server. Refuse
    // to open anything that provably is not what the will recorded.
    await checkCid(cid, container);
    if (!isSealed(container)) {
      throw new Error(
        "This document predates encrypted storage and can no longer be opened. Re-upload it to seal it."
      );
    }

    const identity = await unlock();
    const { bytes, name, mime } = await unsealFile(container, identity, wallet);

    if (isTextual(mime)) {
      return {
        ...EMPTY,
        textPreview: new TextDecoder().decode(bytes),
        fileName: name,
        mimeType: mime,
        fileSize: bytes.byteLength,
      };
    }

    const url = URL.createObjectURL(
      new Blob([bytes as BlobPart], { type: mime })
    );
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    return {
      ...EMPTY,
      objectUrl: url,
      fileName: name,
      mimeType: mime,
      fileSize: bytes.byteLength,
    };
    // `session` is intentionally not a dependency: only `signedIn` matters and
    // re-creating this on every session object identity would refetch endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, wallet, unlock, session.signedIn]);

  const query = useQuery({
    queryKey: ["mediaContent", cid, wallet],
    queryFn: load,
    enabled: !!cid && !!wallet,
    // Ciphertext for a CID never changes, and decryption is not free — but the
    // result holds an object URL revoked on unmount, so it must not be cached
    // past this viewer (gcTime 0), and plaintext should not linger in memory.
    staleTime: 5 * 60_000,
    gcTime: 0,
    retry: false,
  });

  const content = query.data ?? EMPTY;

  const downloadFile = useCallback(() => {
    if (!content.objectUrl || !content.fileName) return;
    const a = document.createElement("a");
    a.href = content.objectUrl;
    a.download = content.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [content.objectUrl, content.fileName]);

  /**
   * Save the ENCRYPTED container locally. It is useless without the holder's
   * wallet, so it is safe to keep anywhere — and it means the document no
   * longer depends on this app's storage account surviving: the bytes can be
   * re-pinned to any IPFS node, where the CID recorded on-chain finds them.
   */
  const downloadSealedBackup = useCallback(async () => {
    if (!session.signedIn) await session.signIn();
    const container = await fetchSealedContainer(cid);
    await checkCid(cid, container);
    const url = URL.createObjectURL(
      new Blob([container as BlobPart], { type: "application/octet-stream" })
    );
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cid}.vseal`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      // Deferred so the browser has started the download before the URL dies.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, session.signedIn]);

  return {
    loading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    objectUrl: content.objectUrl,
    textPreview: content.textPreview,
    /** Real filename, recovered from inside the sealed container. */
    fileName: content.fileName,
    /** Real MIME type, recovered from inside the sealed container. */
    mimeType: content.mimeType,
    fileSize: content.fileSize,
    downloadFile,
    downloadSealedBackup,
  };
}
