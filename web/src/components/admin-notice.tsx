/** Full-width status message for admin pages with nothing to show. */
export function AdminNotice({ message }: { message: string }) {
  return (
    <div className="p-6">
      <p className="card p-4 text-[13px] text-muted" role="status">
        {message}
      </p>
    </div>
  );
}
