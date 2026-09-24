export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function shortHash(hash: string): string {
  if (!hash) return "";
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

export function conversationTone(type: string): "brand" | "success" | "warning" | "neutral" {
  switch (type) {
    case "Sales":
      return "brand";
    case "Support":
      return "success";
    case "Billing":
      return "warning";
    default:
      return "neutral";
  }
}
