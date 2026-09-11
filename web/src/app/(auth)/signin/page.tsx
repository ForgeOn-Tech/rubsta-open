import { signInWithDemo, signInWithGoogle } from "./actions";
import { ClearOfflinePages } from "./clear-offline-pages";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  google: "Google sign-in did not complete. Try again.",
  demo: "Demo sign-in is not available. Is DEMO_AUTH set?",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
  const demoEnabled = process.env.DEMO_AUTH === "true";

  const unconfigured = !googleEnabled && !demoEnabled;

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-12"
      style={{ background: "var(--color-surface-0)" }}
    >
      <ClearOfflinePages />
      <div className="card w-full max-w-sm p-8">
        <div className="eyebrow">Tournament OS · Entry</div>
        <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.01em]">
          Rubsta Open
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--color-muted)" }}>
          Sign in to register for the tournament.
        </p>

        {unconfigured ? (
          <p
            className="mt-6 border p-4 text-[13px]"
            style={{
              borderColor: "var(--color-line)",
              color: "var(--color-muted)",
            }}
            role="alert"
          >
            Sign-in is not configured. Set{" "}
            <span className="mono">GOOGLE_CLIENT_ID</span> /{" "}
            <span className="mono">GOOGLE_CLIENT_SECRET</span> or{" "}
            <span className="mono">DEMO_AUTH=true</span> (see{" "}
            <span className="mono">.env.example</span>).
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-3">
            {googleEnabled ? (
              <form action={signInWithGoogle}>
                <button type="submit" className="btn btn-outline w-full">
                  <GoogleMark /> Continue with Google
                </button>
              </form>
            ) : null}
            {demoEnabled ? (
              <form action={signInWithDemo}>
                <button type="submit" className="btn btn-primary w-full">
                  Continue with demo account
                </button>
              </form>
            ) : null}
          </div>
        )}

        {error && error !== "unconfigured" ? (
          <p
            className="mt-4 text-[12px]"
            style={{ color: "var(--color-bad)" }}
            role="alert"
          >
            {ERROR_COPY[error] ?? "Sign-in did not complete. Try again."}
          </p>
        ) : null}

        {demoEnabled ? (
          <p
            className="mono mt-6 text-[10px] uppercase tracking-[0.08em]"
            style={{ color: "var(--color-dim)" }}
          >
            Demo mode · signs in as demo@rubstaopen.local
          </p>
        ) : null}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z"
      />
    </svg>
  );
}
