"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { startTransition, useOptimistic, useState } from "react";

import { clockOf } from "@/lib/auto-schedule";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import type { CourtOption } from "@/lib/schedule";
import { SLOT_MINUTES, dropTime, slotStarts, type GridRange } from "@/lib/schedule-grid";

/** One match or session on the grid, or a match in the tray with no place yet. */
export interface GridCard {
  /** The schedule item's id, or the match's id for a card in the tray. */
  key: string;
  itemId: string | null;
  matchId: string | null;
  /** e.g. "Open singles · Group A · M3", or a session's title. */
  title: string;
  /** e.g. "A Rao v B Shah"; null for a session. */
  players: string | null;
  courtNumber: number | null;
  start: number | null;
  minutes: number;
  /** Started, finished or a session: it stays where it is. */
  locked: boolean;
  /** e.g. "Live" or "Done" for a locked match. */
  badge: string | null;
  /** Clashes with the player's other matches today. */
  warnings: string[];
}

/** Pixels for one SLOT_MINUTES row. */
const ROW_PX = 20;
const MIN_CARD_PX = 36;
const TRAY_ID = "tray";
const COURT_PREFIX = "court-";
/** A pointer must move this far before a drag starts, so a click still works. */
const DRAG_DISTANCE_PX = 6;
/** On touch, hold this long to drag, so a swipe still scrolls. */
const TOUCH_DELAY_MS = 200;
const TOUCH_TOLERANCE_PX = 6;

type Drop = { card: GridCard; courtNumber: number | null; start: number | null };

function moved(cards: readonly GridCard[], drop: Drop): GridCard[] {
  return cards.map((card) => (card.key === drop.card.key ? { ...card, courtNumber: drop.courtNumber, start: drop.start } : card));
}

function px(minutes: number): number {
  return (minutes / SLOT_MINUTES) * ROW_PX;
}

function spanLabel(card: GridCard): string | null {
  return card.start === null ? null : `${clockOf(card.start)}–${clockOf(card.start + card.minutes)}`;
}

function CardBody({ card }: { card: GridCard }) {
  const span = spanLabel(card);
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono text-[10.5px] text-muted">{span ?? `${card.minutes} min`}</span>
        {card.badge === null ? null : <span className="caps text-[9.5px]">{card.badge}</span>}
      </div>
      <div className="truncate text-[11.5px] font-semibold leading-tight">{card.title}</div>
      {card.players === null ? null : <div className="truncate text-[11px] leading-tight text-muted">{card.players}</div>}
      {card.warnings.length === 0 ? null : (
        <ul aria-label="Clashes" className="mt-0.5">
          {card.warnings.map((warning) => (
            <li key={warning} className="truncate text-[10.5px] leading-tight text-bad">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DraggableCard({ card, placed, range }: { card: GridCard; placed: boolean; range: GridRange }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.key, data: card, disabled: card.locked });
  const span = spanLabel(card);
  const where = card.courtNumber === null || span === null ? "not placed" : `Court ${card.courtNumber}, ${span}`;
  const clash = card.warnings.length > 0;
  const style = {
    transform: transform === null ? undefined : `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    borderLeftColor: clash ? "var(--color-bad)" : card.locked ? "var(--color-dim)" : "var(--color-accent)",
    ...(placed && card.start !== null
      ? { position: "absolute" as const, top: px(card.start - range.from), height: Math.max(MIN_CARD_PX, px(card.minutes)), left: 4, right: 4 }
      : { minHeight: MIN_CARD_PX }),
  };
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${card.title}${card.players === null ? "" : `, ${card.players}`}, ${where}${card.locked ? ", cannot move" : ""}`}
      className={`card shrink-0 overflow-hidden border-l-[3px] px-2 py-1 ${card.locked ? "cursor-default opacity-70" : "cursor-grab touch-none"} ${
        isDragging ? "z-20 shadow-lg" : "z-10"
      }`}
      style={style}
    >
      <CardBody card={card} />
    </div>
  );
}

function CourtColumn({ court, cards, range }: { court: CourtOption; cards: readonly GridCard[]; range: GridRange }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COURT_PREFIX}${court.number}` });
  return (
    <div
      ref={setNodeRef}
      className={`relative border-l border-line ${isOver ? "bg-surface-2" : ""}`}
      style={{
        height: px(range.to - range.from),
        backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0 1px, transparent 1px ${ROW_PX * (60 / SLOT_MINUTES)}px)`,
      }}
    >
      {cards.map((card) => (
        <DraggableCard key={card.key} card={card} placed range={range} />
      ))}
    </div>
  );
}

function Tray({ cards, range }: { cards: readonly GridCard[]; range: GridRange }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby="tray-heading"
      className={`card flex w-full flex-col gap-2 p-3 lg:sticky lg:top-4 lg:max-h-[80vh] lg:w-64 lg:shrink-0 lg:overflow-y-auto ${
        isOver ? "bg-surface-2" : ""
      }`}
    >
      <h2 id="tray-heading" className="text-[13px] font-semibold">
        Not placed <span className="mono text-[11px] text-dim">{cards.length}</span>
      </h2>
      <p className="text-[11.5px] text-muted">Drag a match onto a court. Drag one back here to take it off the day.</p>
      {cards.map((card) => (
        <DraggableCard key={card.key} card={card} placed={false} range={range} />
      ))}
    </section>
  );
}

/**
 * The day as a court × time grid. Drag a match to another court or time, from the tray onto a
 * court, or back to the tray. Matches under way or finished cannot move. Every change stays a
 * draft until the day is published.
 */
export function ScheduleGrid({
  day,
  courts,
  cards,
  range,
  action,
}: {
  day: string;
  courts: readonly CourtOption[];
  cards: readonly GridCard[];
  range: GridRange;
  action: FormAction;
}) {
  const [shown, showDrop] = useOptimistic(cards as GridCard[], moved);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE_PX } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(event: DragEndEvent) {
    const card = event.active.data.current as GridCard | undefined;
    const over = event.over;
    if (card === undefined || over === null) return;
    const overId = String(over.id);

    const data = new FormData();
    data.set("day", day);
    let drop: Drop;
    if (overId === TRAY_ID) {
      if (card.itemId === null) return;
      data.set("drop", "unschedule");
      data.set("itemId", card.itemId);
      drop = { card, courtNumber: null, start: null };
    } else {
      const courtNumber = Number(overId.slice(COURT_PREFIX.length));
      const top = event.active.rect.current.translated?.top ?? over.rect.top;
      const start = dropTime(range, ((top - over.rect.top) / ROW_PX) * SLOT_MINUTES);
      if (card.courtNumber === courtNumber && card.start === start) return;
      data.set("drop", card.itemId === null ? "place" : "move");
      if (card.itemId !== null) data.set("itemId", card.itemId);
      if (card.matchId !== null) data.set("matchId", card.matchId);
      data.set("courtNumber", String(courtNumber));
      data.set("time", clockOf(start));
      drop = { card, courtNumber, start };
    }

    setError(null);
    startTransition(async () => {
      showDrop(drop);
      const result = await action(INITIAL_ACTION_STATE, data);
      setError(result.error);
    });
  }

  const placedOn = (courtNumber: number) => shown.filter((card) => card.courtNumber === courtNumber && card.start !== null);
  const tray = shown.filter((card) => card.courtNumber === null || card.start === null);
  const hours = slotStarts(range).filter((start) => start % 60 === 0);

  return (
    // A fixed id keeps dnd-kit's screen-reader ids the same on the server and in the browser.
    <DndContext id={`schedule-grid-${day}`} sensors={sensors} onDragEnd={onDragEnd}>
      {error === null ? null : (
        <p className="card p-3 text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Tray cards={tray} range={range} />
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `3.25rem repeat(${courts.length}, minmax(10.5rem, 1fr))` }}>
            <div />
            {courts.map((court) => (
              <h2 key={court.number} className="border-b-2 border-ink px-2 pb-2 text-[13px] font-semibold">
                {court.label}
              </h2>
            ))}
            <div className="relative" style={{ height: px(range.to - range.from) }}>
              {hours.map((hour) => (
                <span key={hour} className="mono absolute right-2 text-[10.5px] text-dim" style={{ top: px(hour - range.from) - 6 }}>
                  {clockOf(hour)}
                </span>
              ))}
            </div>
            {courts.map((court) => (
              <CourtColumn key={court.number} court={court} cards={placedOn(court.number)} range={range} />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
