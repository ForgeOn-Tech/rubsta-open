"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { startTransition, useActionState, useEffect, useOptimistic, useRef, useState, type KeyboardEvent } from "react";

import { ScheduleItemForms } from "./schedule-item-editor";
import type { UmpireOption } from "./schedule-fields";
import { clockOf } from "@/lib/auto-schedule";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import type { CourtOption, ScheduleEntry } from "@/lib/schedule";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/db/schema";
import { CATEGORY_COLORS, SLOT_MINUTES, dropTime, slotStarts, type GridRange } from "@/lib/schedule-grid";

/** One match or session on the grid, or a match in the tray with no place yet. */
export interface GridCard {
  /** The schedule item's id, or the match's id for a card in the tray. */
  key: string;
  itemId: string | null;
  /** The item as the editor needs it; null for a card in the tray. */
  entry: ScheduleEntry | null;
  matchId: string | null;
  /** The match's event, which colours the card; null for a session. */
  category: Category | null;
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
  /** "Not before" or "After the match above" when the start can move; null at a fixed time. */
  timingNote: string | null;
  /** Clashes with the player's other matches today. */
  warnings: string[];
}

/** A court's camera, from its broadcast status: on air, or set up and starting soon. */
export type CourtStream = "live" | "scheduled";

const STREAM_TAGS: Record<CourtStream, string> = { live: "Streaming", scheduled: "Stream starting soon" };

/** A tag beside a court's name for its camera; nothing for a court without one. */
export function StreamTag({ stream }: { stream: CourtStream | undefined }) {
  if (stream === undefined) return null;
  return (
    <span className={`caps ml-2 text-[9.5px] ${stream === "live" ? "text-bad" : "text-muted"}`}>
      {stream === "live" ? "● " : ""}
      {STREAM_TAGS[stream]}
    </span>
  );
}

/** Pixels for one SLOT_MINUTES row. */
const ROW_PX = 20;
const MIN_CARD_PX = 36;
const TRAY_ID = "tray";
const COURT_PREFIX = "court-";
/** A mouse must move this far before a drag starts, so a click still works. */
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
        <span className="mono truncate text-[10.5px] text-muted">
          {span ?? `${card.minutes} min`}
          {card.timingNote === null ? null : <span className="text-warn"> · {card.timingNote}</span>}
        </span>
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

function DraggableCard({
  card,
  placed,
  range,
  onOpen,
}: {
  card: GridCard;
  placed: boolean;
  range: GridRange;
  onOpen: (card: GridCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.key, data: card, disabled: card.locked });
  const editable = card.entry !== null;
  // Enter opens the editor; Space still picks the card up to move it with the arrow keys.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && editable) {
      event.preventDefault();
      onOpen(card);
      return;
    }
    listeners?.onKeyDown?.(event);
  };
  const span = spanLabel(card);
  const where = card.courtNumber === null || span === null ? "not placed" : `Court ${card.courtNumber}, ${span}`;
  const clash = card.warnings.length > 0;
  const style = {
    transform: transform === null ? undefined : `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    borderLeftColor: card.category === null ? "var(--color-dim)" : CATEGORY_COLORS[card.category],
    outline: clash ? "2px solid var(--color-bad)" : undefined,
    outlineOffset: clash ? -2 : undefined,
    ...(placed && card.start !== null
      ? { position: "absolute" as const, top: px(card.start - range.from), height: Math.max(MIN_CARD_PX, px(card.minutes)), left: 4, right: 4 }
      : { minHeight: MIN_CARD_PX }),
  };
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={editable ? () => onOpen(card) : undefined}
      // A short card cuts its warnings off; hovering shows them in full.
      title={clash ? card.warnings.join("\n") : undefined}
      aria-label={`${card.title}${card.players === null ? "" : `, ${card.players}`}, ${where}${card.locked ? ", cannot move" : ""}`}
      className={`card shrink-0 overflow-hidden border-l-4 px-2 py-1 ${card.locked ? "cursor-default opacity-70" : "cursor-grab touch-manipulation"} ${
        isDragging ? "z-20 shadow-lg" : "z-10"
      }`}
      style={style}
    >
      <CardBody card={card} />
    </div>
  );
}

function CourtColumn({
  court,
  cards,
  range,
  onOpen,
}: {
  court: CourtOption;
  cards: readonly GridCard[];
  range: GridRange;
  onOpen: (card: GridCard) => void;
}) {
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
        <DraggableCard key={card.key} card={card} placed range={range} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Tray({ cards, range, onOpen }: { cards: readonly GridCard[]; range: GridRange; onOpen: (card: GridCard) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby="tray-heading"
      className={`card flex max-h-72 w-full flex-col gap-2 overflow-y-auto p-3 lg:sticky lg:top-4 lg:max-h-[80vh] lg:w-64 lg:shrink-0 ${
        isOver ? "bg-surface-2" : ""
      }`}
    >
      <h2 id="tray-heading" className="text-[13px] font-semibold">
        Not placed <span className="mono text-[11px] text-dim">{cards.length}</span>
      </h2>
      <p className="text-[11.5px] text-muted">Drag a match onto a court. Drag one back here to take it off the day.</p>
      {cards.map((card) => (
        <DraggableCard key={card.key} card={card} placed={false} range={range} onOpen={onOpen} />
      ))}
    </section>
  );
}

/** A placed card's editor in a dialog: its time, umpire and court, or taking it off the day. */
function CardEditor({
  card,
  courts,
  umpires,
  action,
  onClose,
}: {
  card: GridCard;
  courts: readonly CourtOption[];
  umpires: readonly UmpireOption[];
  action: FormAction;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [removed, removeAction, removing] = useActionState(action, INITIAL_ACTION_STATE);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (removed.savedAt !== null) onClose();
  }, [removed.savedAt, onClose]);
  if (card.entry === null) throw new Error(`Card ${card.key} has no place to edit.`);
  const entry = card.entry;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="card-editor-heading"
      className="card m-auto w-[min(26rem,calc(100vw-2rem))] p-4 backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="card-editor-heading" className="text-[14px] font-semibold">
            {card.title}
          </h2>
          {card.players === null ? null : <p className="text-[12px] text-muted">{card.players}</p>}
          {card.start === null ? null : (
            <p className="mono mt-1 text-[11px] text-dim">
              Court {entry.courtNumber} · expected {clockOf(card.start)}–{clockOf(card.start + card.minutes)}
            </p>
          )}
        </div>
        <button type="button" className="btn btn-outline h-7 px-2.5 text-[11px]" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
      <ScheduleItemForms entry={entry} courts={courts} umpires={umpires} action={action} />
      <form action={removeAction} className="mt-3 border-t border-line pt-3">
        <input type="hidden" name="itemId" value={entry.id} />
        <button type="submit" name="intent" value="remove" className="btn btn-outline h-8 text-[12px]" disabled={removing}>
          Take off the day
        </button>
        {removed.error ? (
          <p className="mt-2 text-[12px] text-bad" role="alert">
            {removed.error}
          </p>
        ) : null}
      </form>
    </dialog>
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
  streams,
  umpires,
  action,
  editAction,
}: {
  day: string;
  courts: readonly CourtOption[];
  cards: readonly GridCard[];
  range: GridRange;
  /** Courts with a camera, by number: streaming now, or starting soon. */
  streams: ReadonlyMap<number, CourtStream>;
  umpires: readonly UmpireOption[];
  /** Drops: moving, placing and taking off. */
  action: FormAction;
  /** The editor's changes, as in the list view. */
  editAction: FormAction;
}) {
  const [shown, showDrop] = useOptimistic(cards as GridCard[], moved);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // The card as it is now, so the editor shows a saved change.
  const editing = editingKey === null ? null : (shown.find((card) => card.key === editingKey && card.entry !== null) ?? null);
  // A drag ends with a click on the card just dropped; that click must not open its editor.
  const dragging = useRef(false);
  const closeEditor = () => setEditingKey(null);
  const openEditor = (card: GridCard) => {
    if (!dragging.current) setEditingKey(card.key);
  };
  const sensors = useSensors(
    // Mouse and touch apart: a finger must hold a card to drag it, so a swipe still scrolls.
    useSensor(MouseSensor, { activationConstraint: { distance: DRAG_DISTANCE_PX } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX } }),
    // Space picks a card up; Enter is left to open its editor.
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );

  function onDragEnd(event: DragEndEvent) {
    // The browser sends that click straight after the drop, before this timeout runs.
    setTimeout(() => {
      dragging.current = false;
    }, 0);
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
  const events = CATEGORIES.filter((category) => shown.some((card) => card.category === category));

  return (
    // A fixed id keeps dnd-kit's screen-reader ids the same on the server and in the browser.
    <DndContext
      id={`schedule-grid-${day}`}
      sensors={sensors}
      onDragStart={() => {
        dragging.current = true;
      }}
      onDragCancel={() => {
        dragging.current = false;
      }}
      onDragEnd={onDragEnd}
    >
      {error === null ? null : (
        <p className="card p-3 text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
      {events.length === 0 ? null : (
        <ul aria-label="Events" className="flex flex-wrap gap-x-4 gap-y-1.5">
          {events.map((category) => (
            <li key={category} className="flex items-center gap-1.5 text-[12px] text-muted">
              <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: CATEGORY_COLORS[category] }} />
              {CATEGORY_LABELS[category]}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Tray cards={tray} range={range} onOpen={openEditor} />
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `3.25rem repeat(${courts.length}, minmax(10.5rem, 1fr))` }}>
            <div />
            {courts.map((court) => (
              <h2 key={court.number} className="border-b-2 border-ink px-2 pb-2 text-[13px] font-semibold">
                {court.label}
                <StreamTag stream={streams.get(court.number)} />
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
              <CourtColumn key={court.number} court={court} cards={placedOn(court.number)} range={range} onOpen={openEditor} />
            ))}
          </div>
        </div>
      </div>
      {editing === null ? null : (
        <CardEditor key={editing.key} card={editing} courts={courts} umpires={umpires} action={editAction} onClose={closeEditor} />
      )}
    </DndContext>
  );
}
