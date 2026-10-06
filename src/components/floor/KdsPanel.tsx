"use client";

import { useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import type { KdsTicket } from "@/lib/types";
import { PanelHd } from "./FloorView";

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function KdsTicketRow({
  ticket,
  onBump,
}: {
  ticket: KdsTicket;
  onBump: (itemIds: number[]) => void;
}) {
  const { T } = useTheme();
  const m3 = T.m3;
  const color =
    ticket.status === "late"
      ? T.bad
      : ticket.status === "aging"
        ? T.warn
        : T.ok;
  const badge =
    ticket.status === "late"
      ? "LATE"
      : ticket.status === "aging"
        ? "AGING"
        : "FIRING";
  const isTakeout = ticket.orderType === "takeout";

  return (
    <div
      style={
        m3
          ? {
              display: "grid",
              gridTemplateColumns: "64px 1fr auto",
              padding: "12px 14px",
              alignItems: "center",
              gap: 12,
              borderRadius: 16,
              background:
                ticket.status === "late"
                  ? m3.badTint
                  : ticket.status === "aging"
                    ? m3.warnTint
                    : isTakeout
                      ? m3.infoContainer
                      : m3.containerHigh,
            }
          : {
              display: "grid",
              gridTemplateColumns: "64px 1fr auto",
              padding: "10px 16px",
              borderBottom: `1px solid ${T.line}`,
              alignItems: "center",
              gap: 12,
              background: isTakeout ? `${T.info}10` : "transparent",
              borderLeft: isTakeout
                ? `3px solid ${T.info}`
                : "3px solid transparent",
            }
      }
    >
      {/* Elapsed time */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 22,
            fontWeight: 700,
            color,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {fmtElapsed(ticket.elapsedSec)}
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color,
            marginTop: 3,
          }}
        >
          {badge}
        </div>
      </div>

      {/* Meta + item name */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: T.mono,
              background: ticket.station === "kitchen" ? T.chip : `${T.info}22`,
              color: ticket.station === "kitchen" ? T.textDim : T.info,
              padding: m3 ? "2px 8px" : "1px 6px",
              borderRadius: m3 ? 8 : 2,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {ticket.station === "kitchen" ? "KIT" : "BAR"}
          </span>
          {isTakeout && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.info,
                background: `${T.info}20`,
                border: `1px solid ${T.info}44`,
                padding: m3 ? "2px 8px" : "1px 6px",
                borderRadius: m3 ? 8 : 2,
              }}
            >
              TO
            </span>
          )}
          <span style={{ fontSize: 12, color: T.textDim }}>
            · {ticket.tableId}
          </span>
          <span style={{ fontSize: 12, color: T.textMute }}>
            · {ticket.server}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: m3 ? 15 : 13,
              color: T.text,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ticket.itemName}
          </span>
          {ticket.qty > 1 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "inherit",
                background: T.accent + "22",
                color: T.accent,
                border: `1px solid ${T.accent}44`,
                padding: "1px 6px",
                borderRadius: m3 ? 8 : 3,
                flexShrink: 0,
              }}
            >
              ×{ticket.qty}
            </span>
          )}
        </div>
      </div>

      {/* Served button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBump(ticket.itemIds);
        }}
        style={
          m3
            ? {
                height: 40,
                padding: "0 18px",
                fontSize: 13,
                fontFamily: "inherit",
                fontWeight: 700,
                background: T.accent,
                border: "none",
                color: T.accentInk,
                borderRadius: 20,
                cursor: "pointer",
              }
            : {
                padding: "5px 12px",
                fontSize: 11,
                fontFamily: "inherit",
                fontWeight: 600,
                background: "transparent",
                border: `1px solid ${T.line2}`,
                color: T.textDim,
                borderRadius: T.radius,
                cursor: "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                transition:
                  "background 0.12s ease, border-color 0.12s ease, color 0.12s ease",
              }
        }
        onMouseEnter={(e) => {
          if (m3) return;
          const b = e.currentTarget;
          b.style.background = T.ok + "22";
          b.style.borderColor = T.ok;
          b.style.color = T.ok;
        }}
        onMouseLeave={(e) => {
          if (m3) return;
          const b = e.currentTarget;
          b.style.background = "transparent";
          b.style.borderColor = T.line2;
          b.style.color = T.textDim;
        }}
      >
        Served
      </button>
    </div>
  );
}

// Filter modes
type FilterMode = "all" | "kitchen" | "bar";

export default function KdsPanel({
  tickets,
  tick: _tick,
  onBump,
}: {
  tickets: KdsTicket[];
  tick: number;
  onBump: (itemIds: number[]) => void;
}) {
  const { T } = useTheme();
  const m3 = T.m3;
  const [filter, setFilter] = useState<FilterMode>("all");

  const visible =
    filter === "all" ? tickets : tickets.filter((t) => t.station === filter);
  const openCount = tickets.length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
      }}
    >
      <PanelHd
        title={
          <>
            <span style={{ color: T.accent, marginRight: 8 }}>●</span>Live ·
            Kitchen + Bar
          </>
        }
        badge={`${openCount} open`}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Auto-refresh indicator */}
            <span
              style={{ fontSize: 10, color: T.textMute, fontFamily: T.mono }}
            >
              auto-refresh 1s
            </span>
            {/* Station filter */}
            <div
              style={
                m3
                  ? {
                      display: "flex",
                      gap: 4,
                      background: m3.track,
                      borderRadius: 18,
                      padding: 3,
                    }
                  : { display: "flex", gap: 2 }
              }
            >
              {(["all", "kitchen", "bar"] as FilterMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilter(m)}
                  style={{
                    padding: m3 ? "6px 12px" : "4px 10px",
                    fontSize: m3 ? 12 : 11,
                    fontFamily: "inherit",
                    background:
                      filter === m ? T.accent : m3 ? "transparent" : T.chip,
                    color: filter === m ? T.accentInk : T.textDim,
                    border: "none",
                    borderRadius: T.radius,
                    cursor: "pointer",
                    fontWeight: filter === m ? 600 : 400,
                    textTransform: "capitalize",
                    transition: "background 0.12s ease",
                  }}
                >
                  {m === "all" ? "All" : m === "kitchen" ? "Kitchen" : "Bar"}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div
        className="bp-no-scrollbar"
        style={
          m3
            ? {
                flex: 1,
                overflowY: "auto",
                padding: "0 12px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }
            : { flex: 1, overflowY: "auto" }
        }
      >
        {visible.length === 0 ? (
          <div
            style={{
              padding: "24px 20px",
              color: T.textMute,
              fontSize: 13,
              fontFamily: T.mono,
            }}
          >
            No open tickets
          </div>
        ) : (
          visible.map((t) => (
            <KdsTicketRow key={t.id} ticket={t} onBump={onBump} />
          ))
        )}
      </div>
    </div>
  );
}
