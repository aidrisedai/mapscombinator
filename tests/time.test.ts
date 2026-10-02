import { describe, expect, it } from "vitest";
import { localToUtc, programWeeks, resolveLocal, weekNumberFor, todayIn } from "@/lib/time";

describe("time", () => {
  it("generates seven-local-day weeks", () => {
    const w = programWeeks("2026-10-05", 12);
    expect(w).toHaveLength(12);
    expect(w[0]).toEqual({ number: 1, startDate: "2026-10-05", endDate: "2026-10-11" });
    // Crosses the Nov 1 DST change without drifting.
    expect(w[4]).toEqual({ number: 5, startDate: "2026-11-02", endDate: "2026-11-08" });
    expect(weekNumberFor("2026-10-05", 12, "2026-10-11")).toBe(1);
    expect(weekNumberFor("2026-10-05", 12, "2026-10-12")).toBe(2);
    expect(weekNumberFor("2026-10-05", 12, "2026-10-04")).toBeNull();
    expect(weekNumberFor("2026-10-05", 12, "2026-12-28")).toBeNull();
  });

  it("preserves local wall-clock across DST", () => {
    const before = localToUtc("2026-10-27", "17:00", "America/Los_Angeles")!;
    const after = localToUtc("2026-11-03", "17:00", "America/Los_Angeles")!;
    expect(before.toISOString()).toBe("2026-10-28T00:00:00.000Z"); // PDT -7
    expect(after.toISOString()).toBe("2026-11-04T01:00:00.000Z"); // PST -8
  });

  it("detects nonexistent and ambiguous local times", () => {
    expect(resolveLocal("2027-03-14", "02:30", "America/Los_Angeles").kind).toBe("nonexistent");
    const amb = resolveLocal("2026-11-01", "01:30", "America/Los_Angeles");
    expect(amb.kind).toBe("ambiguous");
    if (amb.kind === "ambiguous") {
      expect(amb.earlier.toISOString()).toBe("2026-11-01T08:30:00.000Z");
      expect(amb.later.toISOString()).toBe("2026-11-01T09:30:00.000Z");
    }
    expect(localToUtc("2026-11-01", "01:30", "America/Los_Angeles")).toBeNull();
    expect(localToUtc("2026-11-01", "01:30", "America/Los_Angeles", "later")!.toISOString()).toBe(
      "2026-11-01T09:30:00.000Z",
    );
  });

  it("computes local today", () => {
    expect(todayIn("America/Los_Angeles", new Date("2026-10-02T05:00:00Z"))).toBe("2026-10-01");
  });
});
