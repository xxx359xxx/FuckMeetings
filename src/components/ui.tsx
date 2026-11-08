import { tr } from "../lib/i18n";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, Copy, TriangleExclamationPoint, X } from "lucide-react";
import { cn } from "../lib/utils";

export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-mist-400/25 border-t-accent-400",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-500 text-white hover:bg-accent-600 shadow-lg shadow-accent-500/20",
  secondary:
    "border border-ink-600 bg-ink-800 text-mist-100 hover:bg-ink-700",
  ghost: "text-mist-300 hover:bg-ink-800 hover:text-mist-100",
  danger:
    "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
};

export function Button({
  variant = "secondary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

type BadgeTone = "neutral" | "accent" | "green" | "red" | "amber";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-ink-600 bg-ink-800 text-mist-300",
  accent: "border-accent-500/30 bg-accent-500/15 text-accent-400",
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  red: "border-red-500/25 bg-red-500/10 text-red-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fade-up rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("block", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-mist-200">{label}</span>
        {hint ? (
          <span className="text-[11px] text-ink-500">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ErrorBanner({
  text,
  onClose,
}: {
  text: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 text-[12px] text-red-300">
      <TriangleExclamationPoint size={14} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{tr(text)}</span>
      {onClose ? (
        <button
          onClick={onClose}
          className="shrink-0 text-red-300/70 transition hover:text-red-200"
          title={tr("Скрыть")}
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-mist-400 transition hover:bg-ink-800 hover:text-mist-100",
        className,
      )}
      title={tr("Скопировать")}
    >
      {done ? (
        <Check size={12} className="text-emerald-400" />
      ) : (
        <Copy size={12} />
      )}
      {done ? tr("Скопировано") : tr("Копировать")}
    </button>
  );
}

export const inputCls =
  "rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 text-sm text-mist-100 placeholder:text-ink-500 outline-none transition focus:border-accent-500/70 focus:ring-2 focus:ring-accent-500/20";
