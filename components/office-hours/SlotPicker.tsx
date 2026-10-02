"use client";

import { cx } from "@/components/ui/primitives";
import { groupSlots, type SlotView } from "./slots";

/** Keyboard-operable slot chooser (radio group per local date). */
export function SlotPicker({ slots, selectedId, onSelect, name = "slot" }: { slots: SlotView[]; selectedId: string | null; onSelect: (id: string) => void; name?: string }) {
  return (
    <div className="space-y-5">
      {groupSlots(slots).map(([key, g]) => (
        <fieldset key={key}>
          <legend className="mb-2 text-sm font-semibold text-ink">{g.label}</legend>
          <div className="flex flex-wrap gap-2">
            {g.slots.map((s) => (
              <label
                key={s.id}
                className={cx(
                  "cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald/40",
                  selectedId === s.id ? "border-forest bg-forest text-paper" : "border-line bg-paper text-ink hover:border-forest",
                )}
              >
                <input type="radio" name={name} value={s.id} checked={selectedId === s.id} onChange={() => onSelect(s.id)} className="sr-only" />
                {s.timeLabel}
                <span className={cx("ml-1 text-xs", selectedId === s.id ? "text-paper/80" : "text-ink/50")}>({s.minutes} min)</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
