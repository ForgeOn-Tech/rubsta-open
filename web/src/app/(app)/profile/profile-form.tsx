"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import { saveProfile, type ProfileFormState } from "./actions";
import {
  type Category,
  GENDERS,
  GENDER_LABELS,
  HANDS,
  HAND_LABELS,
  type Gender,
  type Hand,
  type PreviousTournament,
  type Profile,
} from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { REGISTRATION_OPTIONS, registrationOptionLabel } from "@/lib/registration-pricing";
import { registrationPrice } from "@/lib/registration-pricing";
import { formatFee } from "@/lib/format";

interface ProfileFormProps {
  initial: Pick<Profile, "fullName" | "dateOfBirth" | "gender" | "mobile" | "club" | "bestRanking" | "previousTournaments" | "plays"> | null;
  fallbackName: string;
  email: string;
  registration?: {
    tournamentId: string;
    enteredCategories: readonly Category[];
    feeLabels: Record<Category, string>;
    feeCents: Record<Category, number>;
    paymentsEnabled: boolean;
  };
}

interface TournamentRow {
  name: string;
  year: string;
  result: string;
}

export function ProfileForm({ initial, fallbackName, email, registration }: ProfileFormProps) {
  const [category, setCategory] = useState("");
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    saveProfile,
    { error: null },
  );

  const [fullName, setFullName] = useState(initial?.fullName ?? fallbackName);
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? "");
  const [gender, setGender] = useState<Gender | "">(initial?.gender ?? "");
  const [mobile, setMobile] = useState(initial?.mobile ?? "");
  const [club, setClub] = useState(initial?.club ?? "");
  const [bestRanking, setBestRanking] = useState(initial?.bestRanking ?? "");
  const [plays, setPlays] = useState<Hand | "">(initial?.plays ?? "");
  const [rows, setRows] = useState<TournamentRow[]>(
    (initial?.previousTournaments ?? []).map((t: PreviousTournament) => ({
      name: t.name,
      year: String(t.year),
      result: t.result,
    })),
  );

  const age = ageFromDob(dateOfBirth);

  function updateRow(index: number, patch: Partial<TournamentRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Stop the native GET submit, then serialize the tournament rows into the
    // hidden JSON field before the server action sees the FormData.
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const tournaments = rows
      .filter((row) => row.name.trim() !== "")
      .map((row) => ({
        name: row.name.trim(),
        year: Number.parseInt(row.year, 10),
        result: row.result.trim(),
      }))
      .filter((row) => Number.isFinite(row.year));
    data.set("previousTournaments", JSON.stringify(tournaments));
    // useActionState dispatches must run inside a transition.
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="caps" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          className="field"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="name"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="caps" htmlFor="dateOfBirth">
            Date of birth
          </label>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            className="field"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
        </div>
        <div>
          <span className="caps">Age</span>
          <div
            className="field"
            style={{ color: "var(--color-muted)" }}
            aria-live="polite"
          >
            <span className="mono">{age ?? "·"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="caps" htmlFor="gender">
            Gender
          </label>
          <select
            id="gender"
            name="gender"
            className="field"
            value={gender}
            onChange={(event) => setGender(event.target.value as Gender)}
          >
            <option value="" disabled>
              Select
            </option>
            {GENDERS.map((value) => (
              <option key={value} value={value}>
                {GENDER_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="caps" htmlFor="bestRanking">
            Best ranking
          </label>
          <input
            id="bestRanking"
            name="bestRanking"
            className="field"
            placeholder="State 24"
            value={bestRanking}
            onChange={(event) => setBestRanking(event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="caps" htmlFor="plays">
          Plays
        </label>
        <select
          id="plays"
          name="plays"
          className="field"
          value={plays}
          onChange={(event) => setPlays(HANDS.find((hand) => hand === event.target.value) ?? "")}
        >
          <option value="">Not set</option>
          {HANDS.map((hand) => (
            <option key={hand} value={hand}>
              {HAND_LABELS[hand]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="caps" htmlFor="mobile">
          Mobile
        </label>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          className="field"
          autoComplete="tel"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
        />
      </div>

      <div>
        <label className="caps" htmlFor="club">
          Club
        </label>
        <input
          id="club"
          name="club"
          className="field"
          value={club}
          onChange={(event) => setClub(event.target.value)}
        />
      </div>

      <div>
        <span className="caps">Email</span>
        <div
          className="field"
          style={{ color: "var(--color-muted)" }}
          aria-readonly
        >
          {email}
        </div>
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--color-dim)" }}>
          Your player account and confirmation go to this address.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="caps">Previous tournaments</span>
          <button
            type="button"
            className="flex items-center gap-1 text-[12px] font-semibold text-accent"
            onClick={() =>
              setRows((current) => [
                ...current,
                { name: "", year: String(new Date().getFullYear()), result: "" },
              ])
            }
          >
            <PlusIcon /> Add
          </button>
        </div>
        {rows.length === 0 ? (
          <p
            className="mt-2 border p-3 text-[12px]"
            style={{
              borderColor: "var(--color-line)",
              color: "var(--color-dim)",
            }}
          >
            No previous tournaments added.
          </p>
        ) : (
          <div className="card mt-2 divide-y">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_72px_1fr_28px] items-center gap-2 px-3 py-2">
                <input
                  aria-label={`Tournament ${index + 1} name`}
                  className="h-9 w-full border bg-surface-1 px-2 text-[13px]"
                  style={{ borderColor: "var(--color-line)" }}
                  placeholder="Tournament name"
                  value={row.name}
                  onChange={(event) =>
                    updateRow(index, { name: event.target.value })
                  }
                />
                <input
                  aria-label={`Tournament ${index + 1} year`}
                  className="mono h-9 w-full border bg-surface-1 px-2 text-[13px]"
                  style={{ borderColor: "var(--color-line)" }}
                  inputMode="numeric"
                  placeholder="Year"
                  value={row.year}
                  onChange={(event) =>
                    updateRow(index, { year: event.target.value })
                  }
                />
                <input
                  aria-label={`Tournament ${index + 1} result`}
                  className="h-9 w-full border bg-surface-1 px-2 text-[13px]"
                  style={{ borderColor: "var(--color-line)" }}
                  placeholder="Result"
                  value={row.result}
                  onChange={(event) =>
                    updateRow(index, { result: event.target.value })
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove tournament ${index + 1}`}
                  className="flex h-7 w-7 items-center justify-center text-dim hover:text-bad"
                  onClick={() =>
                    setRows((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <CrossIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {registration ? (
        <section className="flex flex-col gap-3" aria-label="Event entry">
          <input type="hidden" name="intent" value="register" />
          <input type="hidden" name="tournamentId" value={registration.tournamentId} />
          <label className="caps" htmlFor="category">Choose your event or approved combo</label>
          <select id="category" name="selection" className="field" required
            value={category} onChange={event => setCategory(event.target.value)}>
            <option value="" disabled>Select an option</option>
            {REGISTRATION_OPTIONS.map(option => (
              <option key={option.id} value={option.id} disabled={option.categories.some(value => registration.enteredCategories.includes(value))}>
                {registrationOptionLabel(option.id)} · {formatFee(registrationPrice(registration.feeCents, option.categories), "INR")}
              </option>
            ))}
          </select>
          {category.includes("OD") ? (
            <>
              <label className="caps" htmlFor="partnerName">Partner name</label>
              <input id="partnerName" name="partnerName" className="field" required />
              <label className="caps" htmlFor="partnerEmail">Partner email</label>
              <input id="partnerEmail" name="partnerEmail" type="email" className="field" required />
              <p className="text-[12px] text-muted">The doubles fee covers your team. Your partner will need to accept the invitation.</p>
            </>
          ) : null}
        </section>
      ) : null}

      {state.error ? (
        <p className="text-[12px]" style={{ color: "var(--color-bad)" }} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Link href="/home" className="caps">
          Back to home
        </Link>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending}
          style={{ height: 48 }}
        >
          {pending ? "Saving…" : initial ? "Save profile" : registration ? registration.paymentsEnabled ? "Continue to payment" : "Create profile & enter" : "Create profile"}
        </button>
      </div>
    </form>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
