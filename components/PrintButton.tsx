"use client";
export function PrintButton() {
  return (
    <button type="button" className="btn btn-quiet w-full" onClick={() => window.print()}>
      Download PDF
    </button>
  );
}
