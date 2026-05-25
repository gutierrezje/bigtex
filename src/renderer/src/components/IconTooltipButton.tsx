import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const TOOLTIP_GAP_PX = 6;

const TOOLTIP_CLASS =
  "pointer-events-none fixed z-[10000] w-max max-w-[16rem] whitespace-nowrap rounded border border-border bg-surface-raised px-2 py-1 text-[10px] font-medium leading-snug text-text-secondary shadow-lg";

export interface IconTooltipButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title"> {
  hint: string;
  tooltipPlacement?: "above" | "below" | "left" | "right";
  children?: ReactNode;
}

function tooltipPosition(
  placement: NonNullable<IconTooltipButtonProps["tooltipPlacement"]>,
  rect: DOMRect,
): CSSProperties {
  const gap = TOOLTIP_GAP_PX;
  switch (placement) {
    case "below":
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2,
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - gap,
        transform: "translate(-100%, -50%)",
      };
    case "right":
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + gap,
        transform: "translateY(-50%)",
      };
    default:
      return {
        top: rect.top - gap,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      };
  }
}

/** Icon control with a portaled tooltip so hints are not clipped by panel splits. */
export function IconTooltipButton({
  hint,
  tooltipPlacement = "above",
  className = "",
  children,
  disabled,
  type = "button",
  onBlur,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: IconTooltipButtonProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties | null>(null);

  const syncTooltipPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || disabled) return;
    setTooltipStyle(tooltipPosition(tooltipPlacement, el.getBoundingClientRect()));
  }, [disabled, tooltipPlacement]);

  const showTooltip = useCallback(() => {
    if (disabled) return;
    syncTooltipPosition();
    setTooltipOpen(true);
  }, [disabled, syncTooltipPosition]);

  const hideTooltip = useCallback(() => {
    setTooltipOpen(false);
    setTooltipStyle(null);
  }, []);

  useEffect(() => {
    if (!tooltipOpen) return;
    syncTooltipPosition();
  }, [hint, tooltipOpen, syncTooltipPosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type={type}
        aria-label={hint}
        disabled={disabled}
        className={className.trim()}
        onMouseEnter={(event) => {
          showTooltip();
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          hideTooltip();
          onMouseLeave?.(event);
        }}
        onFocus={(event) => {
          showTooltip();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          hideTooltip();
          onBlur?.(event);
        }}
        {...rest}
      >
        {children}
      </button>
      {tooltipOpen && tooltipStyle
        ? createPortal(
            <span role="tooltip" className={TOOLTIP_CLASS} style={tooltipStyle}>
              {hint}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
