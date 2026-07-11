import { useState, useEffect } from "react";

export function useMediaContent(cid: string, mediaType: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | null = null;

    async function fetchContent() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/ipfs/retrieve?cid=${cid}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || `HTTP error ${res.status}`);
        }

        const sizeHeader = res.headers.get("content-length");
        if (sizeHeader) {
          setFileSize(parseInt(sizeHeader, 10));
        }

        const isText =
          mediaType.startsWith("text/") ||
          mediaType.includes("json") ||
          mediaType.includes("javascript") ||
          mediaType.includes("xml") ||
          mediaType.includes("markdown");

        if (isText) {
          const text = await res.text();
          if (active) {
            setTextPreview(text);
            setLoading(false);
          }
        } else {
          const blob = await res.blob();
          if (active) {
            url = URL.createObjectURL(blob);
            setObjectUrl(url);
            setLoading(false);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load content");
          setLoading(false);
        }
      }
    }

    fetchContent();

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [cid, mediaType]);

  const downloadFile = () => {
    if (!objectUrl) return;
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `ipfs-${cid}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return { loading, error, objectUrl, textPreview, fileSize, downloadFile };
}
