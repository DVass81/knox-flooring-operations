import type { CSSProperties, ReactNode } from "react";

export function ProductBrand({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 ${dark ? "text-white" : "text-foreground"}`}
    >
      <span
        aria-hidden="true"
        className="block h-11 w-10 shrink-0 overflow-hidden rounded-md bg-white p-0.5"
      >
        <img
          src="/catalyst-official.png"
          alt=""
          className="h-10 w-[125px] max-w-none object-contain"
        />
      </span>
      <div>
        <span className="block text-[17px] font-semibold tracking-tight">
          Catalyst Works
        </span>
        <span
          className={`block text-[10px] uppercase tracking-[.16em] ${dark ? "text-slate-400" : "text-muted-foreground"}`}
        >
          By Catalyst Innovations
        </span>
      </div>
    </div>
  );
}

export function CompanyBrand({
  companyName,
  companyLogoUrl,
  className = "",
}: {
  companyName: string;
  companyLogoUrl?: string | null;
  className?: string;
}) {
  const name = companyName || "Knoxville Flooring Center";
  const logo =
    companyLogoUrl ||
    (name === "Knoxville Flooring Center" ? "/kfc-logo.png" : null);
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      {logo ? (
        <img
          src={logo}
          alt=""
          className="h-10 w-12 shrink-0 rounded border border-border bg-white object-contain p-1"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded border font-semibold"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 text-sm font-medium leading-5">{name}</span>
    </div>
  );
}

export function ClientBrandScope({
  accent = "#7B00F5",
  children,
}: {
  accent?: string;
  children: ReactNode;
}) {
  const color = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#7B00F5";
  const channels = color
    .slice(1)
    .match(/../g)!
    .map((value) => parseInt(value, 16) / 255);
  const max = Math.max(...channels),
    min = Math.min(...channels),
    delta = max - min,
    light = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  let hue =
    delta === 0
      ? 0
      : max === channels[0]
        ? ((channels[1] - channels[2]) / delta) % 6
        : max === channels[1]
          ? (channels[2] - channels[0]) / delta + 2
          : (channels[0] - channels[1]) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance =
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return (
    <div
      className="client-brand"
      style={
        {
          "--primary": `${hue} ${saturation * 100}% ${light * 100}%`,
          "--primary-foreground": luminance > 0.179 ? "0 0% 0%" : "0 0% 100%",
          "--ring": `${hue} ${saturation * 100}% ${Math.min(light * 100, 50)}%`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
