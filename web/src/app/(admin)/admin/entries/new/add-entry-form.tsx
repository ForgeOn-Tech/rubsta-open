"use client";

import { useActionState, useState } from "react";

import { CATEGORIES, CATEGORY_LABELS, GENDERS, GENDER_LABELS, type Category } from "@/db/schema";
import { ADDED_ENTRY_STATUSES, type AddedEntryStatus, type RawPerson } from "@/lib/admin-add-entry";
import { DOUBLES_CATEGORIES } from "@/lib/entries";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

const STATUS_LABELS: Record<AddedEntryStatus, string> = {
  paid: "Paid (cash or at the desk)",
  confirmed: "Confirmed, fee still due",
};

const EMPTY_PERSON: RawPerson = { fullName: "", email: "", dateOfBirth: "", gender: "", mobile: "", club: "" };

function PersonFields({
  prefix,
  title,
  values,
  onChange,
}: {
  prefix: "player" | "partner";
  title: string;
  values: RawPerson;
  onChange: (values: RawPerson) => void;
}) {
  function update(key: keyof RawPerson, value: string) {
    onChange({ ...values, [key]: value });
  }
  const id = (name: string) => `${prefix}${name}`;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="caps">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="caps" htmlFor={id("FullName")}>Full name</label>
          <input id={id("FullName")} name={id("FullName")} className="field" value={values.fullName} onChange={(event) => update("fullName", event.target.value)} required />
        </div>
        <div>
          <label className="caps" htmlFor={id("Email")}>Email</label>
          <input id={id("Email")} name={id("Email")} type="email" className="field" value={values.email} onChange={(event) => update("email", event.target.value)} required />
        </div>
        <div>
          <label className="caps" htmlFor={id("DateOfBirth")}>Date of birth</label>
          <input id={id("DateOfBirth")} name={id("DateOfBirth")} type="date" className="field" value={values.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} required />
        </div>
        <div>
          <label className="caps" htmlFor={id("Gender")}>Gender</label>
          <select id={id("Gender")} name={id("Gender")} className="field" value={values.gender} onChange={(event) => update("gender", event.target.value)} required>
            <option value="" disabled>Choose</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>{GENDER_LABELS[gender]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="caps" htmlFor={id("Mobile")}>Mobile</label>
          <input id={id("Mobile")} name={id("Mobile")} type="tel" inputMode="tel" className="field" value={values.mobile} onChange={(event) => update("mobile", event.target.value)} required />
        </div>
        <div>
          <label className="caps" htmlFor={id("Club")}>Club (optional)</label>
          <input id={id("Club")} name={id("Club")} className="field" value={values.club} onChange={(event) => update("club", event.target.value)} />
        </div>
      </div>
    </fieldset>
  );
}

export function AddEntryForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  // Controlled fields: React resets uncontrolled fields after a form action, which would clear them on an error.
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [status, setStatus] = useState<AddedEntryStatus>(ADDED_ENTRY_STATUSES[0]);
  const [player, setPlayer] = useState<RawPerson>(EMPTY_PERSON);
  const [partner, setPartner] = useState<RawPerson>(EMPTY_PERSON);
  const doubles = DOUBLES_CATEGORIES.includes(category);

  return (
    <form action={formAction} className="card flex max-w-2xl flex-col gap-5 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="caps" htmlFor="category">Event</label>
          <select id="category" name="category" className="field" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="caps" htmlFor="status">Fee</label>
          <select id="status" name="status" className="field" value={status} onChange={(event) => setStatus(event.target.value as AddedEntryStatus)}>
            {ADDED_ENTRY_STATUSES.map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </div>

      <PersonFields prefix="player" title="Player" values={player} onChange={setPlayer} />
      {doubles ? <PersonFields prefix="partner" title="Partner" values={partner} onChange={setPartner} /> : null}

      <p className="text-[12px] text-muted">
        An email that already has an account keeps its own profile. A doubles partner is accepted straight away.
      </p>

      {state.error ? <p className="text-[12px] text-bad" role="alert">{state.error}</p> : null}

      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Adding…" : "Add entry"}
        </button>
      </div>
    </form>
  );
}
