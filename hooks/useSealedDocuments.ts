import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { DateRange } from "react-day-picker";
import { bytesToCid } from "@/lib/anchor";
import { fetchPinataMetadata } from "@/app/services/pinata.service";

interface MediaItem {
  publicKey: PublicKey;
  account: { mediaIndex: number; ipfsCid: number[]; mediaType: number[] };
}

export type SortOrder = "index" | "newest" | "oldest";

export function useSealedDocuments(media: MediaItem[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>("index");

  const metadataQueries = useQueries({
    queries: media.map((m) => {
      const cid = bytesToCid(m.account.ipfsCid);
      return {
        queryKey: ["ipfs-metadata", cid],
        queryFn: () => fetchPinataMetadata(cid),
        staleTime: 1000 * 60 * 10,
        // CIDv0 is 46 chars, CIDv1 ~59; just require a non-empty decoded CID.
        enabled: cid.length > 0,
      };
    }),
  });

  const filteredMedia = useMemo(() => {
    const mapped = media
      .map((m, idx) => ({
        mediaItem: m,
        metadata: metadataQueries[idx]?.data || null,
      }))
      .filter(({ mediaItem, metadata }) => {
        const fileName = metadata?.name?.toLowerCase() || "";
        const cidStr = bytesToCid(mediaItem.account.ipfsCid).toLowerCase();
        const matchesSearch =
          fileName.includes(searchTerm.toLowerCase()) ||
          cidStr.includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;
        if (!metadata) {
          return !dateRange?.from && !dateRange?.to;
        }

        const createdTime = new Date(metadata.createdAt).getTime();
        if (dateRange?.from && createdTime < dateRange.from.getTime()) return false;
        if (dateRange?.to && createdTime > dateRange.to.getTime() + 86400000) return false;

        return true;
      });

    if (sortOrder === "newest") {
      mapped.sort((a, b) => {
        const timeA = a.metadata ? new Date(a.metadata.createdAt).getTime() : 0;
        const timeB = b.metadata ? new Date(b.metadata.createdAt).getTime() : 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return b.mediaItem.account.mediaIndex - a.mediaItem.account.mediaIndex;
      });
    } else if (sortOrder === "oldest") {
      mapped.sort((a, b) => {
        const timeA = a.metadata ? new Date(a.metadata.createdAt).getTime() : 0;
        const timeB = b.metadata ? new Date(b.metadata.createdAt).getTime() : 0;

        if (timeA === 0) return 1;
        if (timeB === 0) return -1;

        if (timeA !== timeB) {
          return timeA - timeB;
        }
        return a.mediaItem.account.mediaIndex - b.mediaItem.account.mediaIndex;
      });
    } else {
      mapped.sort((a, b) => a.mediaItem.account.mediaIndex - b.mediaItem.account.mediaIndex);
    }

    return mapped;
  }, [media, metadataQueries, searchTerm, dateRange, sortOrder]);

  const hasFilters = !!(searchTerm || dateRange?.from || dateRange?.to || sortOrder !== "index");

  const clearFilters = () => {
    setSearchTerm("");
    setDateRange(undefined);
    setSortOrder("index");
  };

  return {
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    sortOrder,
    setSortOrder,
    filteredMedia,
    hasFilters,
    clearFilters,
  };
}
