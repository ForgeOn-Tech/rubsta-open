"use client";

import { useState } from "react";

import { SCHEDULE_TIMINGS, type ScheduleTiming } from "@/db/schema";
import {
  MAX_BLOCK_NOTE_LENGTH,
  MAX_BLOCK_TITLE_LENGTH,
  SCHEDULE_TIMING_LABELS,
  type CourtOption,
} from "@/lib/schedule";

export type { CourtOption };

export interface UmpireOption {
  email: string;
  label: string;
}

export interface BlockValues {
  title: string;
  note: string;
  time: string;
  endTime: string;
}

// Controlled fields throughout: React resets uncontrolled fields after a form
// action, which would wipe what the admin typed when a save is rejected.

function timingOf(value: string): ScheduleTiming {
  const timing = SCHEDULE_TIMINGS.find((option) => option === value);
  if (timing === undefined) throw new Error(`Unknown timing "${value}".`);
  return timing;
}

export function CourtSelect({
  id,
  label,
  courts,
  initial,
}: {
  id: string;
  label: string;
  courts: readonly CourtOption[];
  initial: number | null;
}) {
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  return (
    <div className="min-w-0">
      <label className="caps" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name="courtNumber"
        className="field"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
      >
        {initial === null ? <option value="">Choose a court</option> : null}
        {courts.map((court) => (
          <option key={court.number} value={court.number}>
            {court.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TimingFields({
  idPrefix,
  initialTiming,
  initialTime,
}: {
  idPrefix: string;
  initialTiming: ScheduleTiming;
  initialTime: string;
}) {
  const [timing, setTiming] = useState<ScheduleTiming>(initialTiming);
  const [time, setTime] = useState(initialTime);
  const followsOn = timing === "followOn";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="min-w-0">
        <label className="caps" htmlFor={`${idPrefix}-timing`}>
          When
        </label>
        <select
          id={`${idPrefix}-timing`}
          name="timing"
          className="field"
          value={timing}
          onChange={(event) => setTiming(timingOf(event.target.value))}
        >
          {SCHEDULE_TIMINGS.map((option) => (
            <option key={option} value={option}>
              {SCHEDULE_TIMING_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label className="caps" htmlFor={`${idPrefix}-time`}>
          Time
        </label>
        {/* A disabled field is not sent, so following on saves no time. */}
        <input
          id={`${idPrefix}-time`}
          name="time"
          type="time"
          className="field mono"
          value={followsOn ? "" : time}
          disabled={followsOn}
          onChange={(event) => setTime(event.target.value)}
        />
      </div>
    </div>
  );
}

export function UmpireSelect({
  id,
  umpires,
  initial,
}: {
  id: string;
  umpires: readonly UmpireOption[];
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const unlisted = initial !== null && !umpires.some((umpire) => umpire.email === initial);

  return (
    <div className="min-w-0">
      <label className="caps" htmlFor={id}>
        Umpire
      </label>
      <select
        id={id}
        name="umpireEmail"
        className="field"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">No umpire</option>
        {umpires.map((umpire) => (
          <option key={umpire.email} value={umpire.email}>
            {umpire.label}
          </option>
        ))}
        {unlisted ? <option value={initial}>{initial} (no longer listed)</option> : null}
      </select>
    </div>
  );
}

export function BlockFields({ idPrefix, initial }: { idPrefix: string; initial: BlockValues }) {
  const [values, setValues] = useState<BlockValues>(initial);

  function update<Key extends keyof BlockValues>(key: Key, value: BlockValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="caps" htmlFor={`${idPrefix}-title`}>
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          name="title"
          className="field"
          maxLength={MAX_BLOCK_TITLE_LENGTH}
          placeholder="Serve Speed Challenge"
          value={values.title}
          onChange={(event) => update("title", event.target.value)}
          required
        />
      </div>
      <div>
        <label className="caps" htmlFor={`${idPrefix}-note`}>
          Note
        </label>
        <input
          id={`${idPrefix}-note`}
          name="note"
          className="field"
          maxLength={MAX_BLOCK_NOTE_LENGTH}
          placeholder="Walk-up entry"
          value={values.note}
          onChange={(event) => update("note", event.target.value)}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="caps" htmlFor={`${idPrefix}-time`}>
            Starts
          </label>
          <input
            id={`${idPrefix}-time`}
            name="time"
            type="time"
            className="field mono"
            value={values.time}
            onChange={(event) => update("time", event.target.value)}
            required
          />
        </div>
        <div className="min-w-0">
          <label className="caps" htmlFor={`${idPrefix}-end`}>
            Ends
          </label>
          <input
            id={`${idPrefix}-end`}
            name="endTime"
            type="time"
            className="field mono"
            value={values.endTime}
            onChange={(event) => update("endTime", event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
