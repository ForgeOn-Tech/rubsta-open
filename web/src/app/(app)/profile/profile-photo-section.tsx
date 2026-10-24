"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PROFILE_PHOTO_CONSENT } from "@/lib/profile-photo-consent";

const PHOTO_PATH = "/api/profile-photo";

async function errorOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `The photo could not be saved (status ${response.status}).`;
  } catch {
    return `The photo could not be saved (status ${response.status}).`;
  }
}

/**
 * The player's photo for their profile and Instagram player card. Players under 18, or
 * without a date of birth, see why they cannot add one.
 */
export function ProfilePhotoSection({
  version,
  accessError,
}: {
  /** When the photo last changed, to show the new one; null with no photo. */
  version: number | null;
  accessError: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(PHOTO_PATH, { method: "POST", body: new FormData(event.currentTarget) });
      if (!response.ok) {
        setError(await errorOf(response));
        return;
      }
      router.refresh();
    } catch {
      setError("The photo could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(PHOTO_PATH, { method: "DELETE" });
      if (!response.ok) {
        setError(await errorOf(response));
        return;
      }
      router.refresh();
    } catch {
      setError("The photo could not be removed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="photo-heading" className="card flex flex-col gap-4 p-5">
      <div>
        <h2 id="photo-heading" className="text-[15px] font-semibold">
          Profile photo
        </h2>
        <p className="mt-1 text-[13px] text-muted">Your photo goes on your player card for Instagram.</p>
      </div>

      {accessError !== null ? (
        <p className="text-[13px] text-muted" role="status">
          {accessError}
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {version === null ? null : (
            // eslint-disable-next-line @next/next/no-img-element -- a private, signed-in image
            <img
              src={`${PHOTO_PATH}?v=${version}`}
              alt="Your profile photo"
              className="h-32 w-32 flex-none border border-line object-cover"
            />
          )}
          <form onSubmit={upload} className="flex min-w-0 flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-[13px]">
              {version === null ? "Choose a photo" : "Choose a new photo"}
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="text-[13px]" />
            </label>
            <label className="flex items-start gap-2 text-[12.5px]">
              <input name="consent" type="checkbox" value="yes" required className="mt-0.5" />
              <span>{PROFILE_PHOTO_CONSENT}</span>
            </label>
            <p className="text-[12px] text-muted">
              JPG, PNG or WebP up to 5 MB. We crop it square and remove the camera details, including location.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save photo"}
              </button>
              {version === null ? null : (
                <button type="button" className="btn btn-outline" onClick={() => void remove()} disabled={busy}>
                  Remove photo
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {error ? (
        <p className="text-[13px] text-bad" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
