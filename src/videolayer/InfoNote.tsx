import { useId, useState, type ReactNode } from "react";

// An (i) button that shows or hides a short explanation under it. Used in the toolbar window and in the settings on
// the page; each styles .vl-info and .vl-info-text in its own sheet.
export const InfoNote = ({ label, children }: { label: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className="vl-info"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
        </svg>
      </button>
      <p id={id} className="vl-info-text" hidden={!open}>
        {children}
      </p>
    </>
  );
};
