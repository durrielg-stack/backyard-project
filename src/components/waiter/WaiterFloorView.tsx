"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useTables } from "@/hooks/useTables";
import { useOpenOrders } from "@/hooks/useOpenOrders";
import { useTickets } from "@/hooks/useTickets";

interface Props {
  waiterName: string;
  onTableSelect: (tableId: string) => void;
  onSignOut: () => void;
}

function elapsed(openedAt: string): string {
  const min = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function WaiterFloorView({
  waiterName,
  onTableSelect,
  onSignOut,
}: Props) {
  const { T, isDark, toggle } = useTheme();
  const m3 = T.m3;
  const { tables } = useTables();
  const { orders, totals } = useOpenOrders();
  const [tick, setTick] = useState(0);
  const { tickets } = useTickets(tick);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function enableScroll() {
      document.documentElement.style.overflow = "auto";
      document.body.style.overflow = "auto";
    }
    enableScroll();
    window.addEventListener("resize", enableScroll);
    return () => {
      window.removeEventListener("resize", enableScroll);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  // Build order lookup by table
  const orderByTable = new Map(orders.map((o) => [o.table_id, o]));

  // Worst KDS ticket status per table (mirrors useAutoStatus logic)
  const STATUS_RANK = { firing: 0, aging: 1, late: 2 } as const;
  const worstTicket = new Map<string, "firing" | "aging" | "late">();
  for (const t of tickets) {
    const prev = worstTicket.get(t.tableId);
    if (!prev || STATUS_RANK[t.status] > STATUS_RANK[prev])
      worstTicket.set(t.tableId, t.status);
  }

  return (
    <div
      className="bp-waiter-root"
      style={{
        background: T.bg,
        minHeight: "100dvh",
        fontFamily: T.sansBody,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.line}`,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
          ...(m3 && {
            background: m3.topBar,
            borderBottom: "none",
            padding: "12px 16px",
            boxShadow: m3.elev1,
          }),
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: T.text,
              ...(m3 && { fontSize: 20, fontWeight: 600 }),
            }}
          >
            Tables
          </div>
          <div
            style={{
              fontSize: 11,
              color: T.textMute,
              ...(m3 && { fontSize: 13, color: T.textDim }),
            }}
          >
            Hi, {waiterName}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={toggle}
            title="Toggle theme"
            style={{
              background: T.surface2,
              border: `1px solid ${T.line2}`,
              borderRadius: T.radiusLg,
              padding: "10px 14px",
              color: T.textDim,
              fontSize: 16,
              cursor: "pointer",
              lineHeight: 1,
              minHeight: 44,
              minWidth: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...(m3 && {
                background: m3.containerHigh,
                border: "none",
                borderRadius: 22,
              }),
            }}
          >
            {isDark ? "☀️" : "🌙"}
          </button>
          <button
            onClick={onSignOut}
            style={{
              background: T.surface2,
              border: `1px solid ${T.line2}`,
              borderRadius: T.radiusLg,
              padding: "10px 16px",
              color: T.textMute,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              ...(m3 && {
                background: m3.containerHigh,
                border: "none",
                borderRadius: 22,
                color: T.text,
              }),
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          padding: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
          ...(m3 && { padding: 16, gap: 12 }),
        }}
      >
        {tables.map((table) => {
          void tick; // triggers re-render for elapsed time refresh
          const order = orderByTable.get(table.id);
          const total = totals.get(table.id) ?? 0;
          const ticketStatus = worstTicket.get(table.id);
          const isOccupied = !!order;

          const isAttention = ticketStatus === "late";
          const isAging = ticketStatus === "aging";

          const borderColor = isAttention
            ? T.bad
            : isAging
              ? T.warn
              : isOccupied
                ? T.ok
                : T.line;
          const dotColor = isAttention
            ? T.bad
            : isAging
              ? T.warn
              : isOccupied
                ? T.ok
                : T.ok;
          const statusLabel = isAttention
            ? "Attention"
            : isAging
              ? "Aging"
              : isOccupied
                ? "Occupied"
                : "Available";
          // M3: tonal tile + status chip (mirrors FloorView TableCard).
          const m3Look = m3
            ? isAttention
              ? {
                  bg: m3.badTint,
                  chipBg: m3.badContainer,
                  chipFg: m3.onBadContainer,
                }
              : isAging
                ? {
                    bg: m3.warnTint,
                    chipBg: m3.warnContainer,
                    chipFg: m3.onWarnContainer,
                  }
                : isOccupied
                  ? {
                      bg: m3.containerHigh,
                      chipBg: m3.okContainer,
                      chipFg: m3.onOkContainer,
                    }
                  : {
                      bg: m3.containerHigh,
                      chipBg: m3.containerHighest,
                      chipFg: T.textDim,
                    }
            : null;

          return (
            <button
              key={table.id}
              onClick={() => onTableSelect(table.id)}
              style={{
                background: T.surface,
                border: `1px solid ${borderColor}`,
                borderRadius: T.radiusLg,
                padding: "14px 12px",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                transition: "background 0.1s",
                ...(m3Look && {
                  background: m3Look.bg,
                  border: "none",
                  borderRadius: 16,
                  padding: 14,
                  gap: 6,
                  minHeight: 108,
                  boxShadow: isAttention ? `0 0 0 2px ${T.bad}` : "none",
                }),
              }}
            >
              {m3Look ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        fontFamily: T.sansHead,
                        letterSpacing: "-0.01em",
                        color: T.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {table.label}
                    </span>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background: m3Look.chipBg,
                        color: m3Look.chipFg,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  {order && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "auto",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: T.mono,
                          color: T.textDim,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {elapsed(order.opened_at)}
                      </span>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          fontFamily: T.mono,
                          color: T.text,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        ₱
                        {total.toLocaleString("en-PH", {
                          minimumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: dotColor,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {table.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: isOccupied ? dotColor : T.headerText,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {statusLabel}
                  </div>
                  {order && (
                    <>
                      <div style={{ fontSize: 11, color: T.textDim }}>
                        {elapsed(order.opened_at)}
                      </div>
                      <div
                        style={{ fontSize: 14, fontWeight: 700, color: T.ok }}
                      >
                        ₱
                        {total.toLocaleString("en-PH", {
                          minimumFractionDigits: 0,
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
