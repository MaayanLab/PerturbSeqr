"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  count?: number | null;
  libraries?: ReadonlyArray<string | null> | null;
};

type TooltipPosition = {
  left: number;
  top: number;
};

export default function LibraryCount({ count, libraries }: Props) {
  const names = libraries?.filter((name): name is string => !!name) ?? [];
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

  const showTooltip = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        left: rect.left + rect.width / 2,
        top: rect.top - 4,
      });
    }
  };

  return (
    <span
      ref={triggerRef}
      className="inline-flex justify-center"
      tabIndex={names.length ? 0 : undefined}
      aria-label={names.length ? `Supporting libraries: ${names.join(", ")}` : undefined}
      onMouseEnter={names.length ? showTooltip : undefined}
      onMouseLeave={names.length ? () => setTooltipPosition(null) : undefined}
      onFocus={names.length ? showTooltip : undefined}
      onBlur={names.length ? () => setTooltipPosition(null) : undefined}
    >
      <span className={names.length ? "underline decoration-dotted cursor-help" : ""}>
        {count ?? 0}
      </span>
      {names.length > 0 && tooltipPosition && createPortal(
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[9999] min-w-max max-w-xs -translate-x-1/2 -translate-y-full rounded bg-gray-700 px-2 py-1 text-left text-xs font-normal text-white shadow-lg"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        >
          <span className="block font-semibold">Supporting libraries</span>
          {names.map((name) => <span className="block" key={name}>{name}</span>)}
        </span>,
        document.body,
      )}
    </span>
  );
}
