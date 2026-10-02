import { Badge } from "@/components/ui/primitives";

export function WeekStateBadge({ state }: { state: string }) {
  if (state === "published") return <Badge tone="published">Published</Badge>;
  if (state === "draft") return <Badge tone="draft">Draft</Badge>;
  if (state === "unpublished") return <Badge tone="warn">Unpublished</Badge>;
  return <Badge tone="neutral">No content yet</Badge>;
}
