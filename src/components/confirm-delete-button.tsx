'use client';

interface ConfirmDeleteButtonProps {
  label: string;
  confirmMessage: string;
  className?: string;
  ariaLabel?: string;
}

export default function ConfirmDeleteButton({
  label,
  confirmMessage,
  className,
  ariaLabel,
}: ConfirmDeleteButtonProps) {
  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
