import { Badge, type BadgeTone } from "@/components/ui/primitives";

const TONE: Record<string, BadgeTone> = { draft: "draft", active: "published", completed: "info", archived: "neutral" };
const LABEL: Record<string, string> = { draft: "Draft", active: "Active", completed: "Completed", archived: "Archived" };

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{LABEL[status] ?? status}</Badge>;
}
