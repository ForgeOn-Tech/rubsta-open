"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary h-8 text-[12px]" onClick={() => window.print()}>
      Print
    </button>
  );
}
