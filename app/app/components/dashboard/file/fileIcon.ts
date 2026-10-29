import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  LucideIcon,
} from "lucide-react";

/** Icon and colour for a document row, from a MIME type or file extension. */
export const getFileIconConfig = (type: string): { Icon: LucideIcon; colorClass: string } => {
  const t = type.toLowerCase().trim();

  // Helper matching checks for extensions or mime prefixes
  const isImage = t.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].some(ext => t === ext || t.endsWith(`/${ext}`) || t.endsWith(`.${ext}`));
  const isVideo = t.startsWith("video/") || ["mp4", "webm", "mkv", "avi", "mov", "wmv"].some(ext => t === ext || t.endsWith(`/${ext}`) || t.endsWith(`.${ext}`));
  const isAudio = t.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].some(ext => t === ext || t.endsWith(`/${ext}`) || t.endsWith(`.${ext}`));
  const isPdf = t === "application/pdf" || t === "pdf" || t.endsWith("/pdf") || t.endsWith(".pdf");
  const isSpreadsheet = t.includes("spreadsheet") || t.includes("excel") || t.includes("sheet") || t === "text/csv" || ["xlsx", "xls", "csv"].some(ext => t === ext || t.endsWith(`/${ext}`) || t.endsWith(`.${ext}`));
  const isArchive = t.includes("zip") || t.includes("tar") || t.includes("rar") || t.includes("compressed") || t.includes("archive") || ["zip", "tar", "gz", "rar", "7z"].some(ext => t === ext || t.endsWith(`/${ext}`) || t.endsWith(`.${ext}`));
  const isCode = t.includes("javascript") || t.includes("json") || t.includes("xml") || t.includes("markdown") || t.startsWith("text/html") || t.startsWith("text/css") || t.startsWith("text/x-") || ["html", "css", "js", "jsx", "ts", "tsx", "json", "xml", "md", "py", "go", "rs", "c", "cpp", "sh"].some(ext => t === ext || t.endsWith(`/${ext}`) || t.endsWith(`.${ext}`));

  if (isImage) {
    return {
      Icon: FileImage,
      colorClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    };
  }
  if (isVideo) {
    return {
      Icon: FileVideo,
      colorClass: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    };
  }
  if (isAudio) {
    return {
      Icon: FileAudio,
      colorClass: "bg-rose-500/10 border-rose-500/20 text-rose-400",
    };
  }
  if (isPdf) {
    return {
      Icon: FileText,
      colorClass: "bg-red-500/10 border-red-500/20 text-red-400",
    };
  }
  if (isSpreadsheet) {
    return {
      Icon: FileSpreadsheet,
      colorClass: "bg-teal-500/10 border-teal-500/20 text-teal-400",
    };
  }
  if (isArchive) {
    return {
      Icon: FileArchive,
      colorClass: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    };
  }
  if (isCode) {
    return {
      Icon: FileCode,
      colorClass: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
    };
  }

  // Default fallback
  return {
    Icon: FileText,
    colorClass: "bg-accent/10 border-accent/20 text-accent",
  };
};
