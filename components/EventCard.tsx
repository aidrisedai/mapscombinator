import type { EventRecord } from "@/content/types";

function formatEventDate(event: EventRecord) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: event.timezone,
  });
  const time = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: event.timezone,
    });
  return { date, time: `${time(start)}–${time(end)}` };
}

export function EventCard({ event }: { event: EventRecord }) {
  const { date, time } = formatEventDate(event);
  const tzShort = event.timezone === "America/Los_Angeles" ? "PT" : event.timezone;
  return (
    <article className="flex flex-col rounded-lg border border-line bg-paper p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald">
        {event.eventType}
      </p>
      <h3 className="mt-2 font-display text-xl font-bold text-forest">
        {event.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">{event.summary}</p>
      <dl className="mt-4 space-y-1.5 border-t border-line/70 pt-4 text-sm text-ink/85">
        <div className="flex gap-2">
          <dt className="font-semibold">Date:</dt>
          <dd>{date}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Time:</dt>
          <dd>
            {time} {tzShort}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Location:</dt>
          <dd>{event.isOnline ? "Online" : event.venueName ?? "To be announced"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Access:</dt>
          <dd>{event.audienceLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Price:</dt>
          <dd>{event.priceLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Registration:</dt>
          <dd>{event.status}</dd>
        </div>
      </dl>
      {event.registrationUrl && event.status === "Open" && (
        <a
          href={event.registrationUrl}
          className="mt-5 inline-block self-start rounded-full bg-forest px-5 py-2 text-sm font-semibold text-paper hover:bg-emerald"
          rel="noopener noreferrer"
        >
          Register
        </a>
      )}
    </article>
  );
}
