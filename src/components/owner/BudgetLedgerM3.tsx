"use client";

import { useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  currentShiftDate,
  ledgerRangeStart,
  parseLocalDate,
  type LedgerRange,
} from "@/lib/dateNav";
import type { LedgerRow } from "./BudgetTab";

// Material 3 Ledger view of the Budget tab (design: the "Owner · Budget ledger"
// artboard). Presentation only — rows come from BudgetTab's buildLedger.

type ColMode = "totals" | "starting" | "incoming" | "expenses" | "ending";

const MODES: [ColMode, string][] = [
  ["totals", "Totals"],
  ["starting", "Starting"],
  ["incoming", "COGS + OPEX in"],
  ["expenses", "Expenses"],
  ["ending", "Ending"],
];

const RANGES: [LedgerRange, string][] = [
  ["week", "This week"],
  ["2weeks", "Last 2 weeks"],
  ["month", "This month"],
  ["all", "All"],
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function peso(v: number): string {
  const s = Math.abs(v).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? "−" : ""}₱${s}`;
}

function signed(v: number): string {
  return `${v < 0 ? "−" : "+"}${peso(Math.abs(v))}`;
}

function shortDate(iso: string): { date: string; dow: string } {
  const d = parseLocalDate(iso);
  return { date: `${MON[d.getMonth()]} ${d.getDate()}`, dow: DOW[d.getDay()] };
}

function sum(rec: Record<string, number>, ids: string[]): number {
  return ids.reduce((s, id) => s + (rec[id] ?? 0), 0);
}

export default function BudgetLedgerM3({
  rows,
  cats,
  seedDate,
  loading,
}: {
  rows: LedgerRow[]; // oldest first, as built by BudgetTab
  cats: { id: string; label: string }[];
  seedDate: string | null;
  loading: boolean;
}) {
  const { T } = useTheme();
  const m3 = T.m3!;
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const [mode, setMode] = useState<ColMode>("ending");
  const [range, setRange] = useState<LedgerRange>("week");

  const ids = cats.map((c) => c.id);
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const from = ledgerRangeStart(range, currentShiftDate());
  const visible = rows.filter((r) => from == null || r.date >= from).reverse();

  // ── Columns for the current mode ──────────────────────────────────────────
  const tone = {
    starting: T.textDim,
    incoming: m3.onOkContainer,
    expenses: T.bad,
    ending: T.text,
  };
  const recKey = {
    starting: "starting",
    incoming: "incoming",
    expenses: "expenses",
    ending: "ending",
  } as const;
  const headers =
    mode === "totals"
      ? ["Starting", "COGS + OPEX in", "Expenses", "Ending", "Net change"]
      : [...cats.map((c) => c.label), "Total"];
  const cols = `${isMobile ? 120 : 200}px repeat(${headers.length}, minmax(${
    isMobile ? 110 : 0
  }px, 1fr))`;

  function cellsFor(
    r: LedgerRow,
  ): { text: string; color: string; bold?: boolean }[] {
    if (mode === "totals") {
      const net = r.incTotal - r.expTotal;
      return [
        {
          text: peso(r.startTotal),
          color: r.startTotal < 0 ? T.bad : tone.starting,
        },
        {
          text: r.incTotal === 0 ? "—" : peso(r.incTotal),
          color: tone.incoming,
        },
        {
          text: r.expTotal === 0 ? "—" : peso(r.expTotal),
          color: tone.expenses,
        },
        {
          text: peso(r.endTotal),
          color: r.endTotal < 0 ? T.bad : tone.ending,
          bold: true,
        },
        { text: signed(net), color: net < 0 ? T.bad : m3.onOkContainer },
      ];
    }
    const rec = r[recKey[mode]];
    const flow = mode === "incoming" || mode === "expenses";
    const out: { text: string; color: string; bold?: boolean }[] = ids.map(
      (id) => {
        const v = rec[id] ?? 0;
        return {
          text: flow && v === 0 ? "—" : peso(v),
          color: v < 0 ? T.bad : tone[mode],
        };
      },
    );
    const total = sum(rec, ids);
    out.push({
      text: peso(total),
      color: total < 0 ? T.bad : tone[mode],
      bold: true,
    });
    return out;
  }

  function exportCsv() {
    const groups = ["starting", "incoming", "expenses", "ending"] as const;
    const head = [
      "date",
      ...groups.flatMap((g) => [
        ...cats.map((c) => `${g} ${c.label}`),
        `${g} total`,
      ]),
    ];
    const lines = [head.join(",")];
    for (const r of [...visible].reverse()) {
      lines.push(
        [
          r.date,
          ...groups.flatMap((g) => [
            ...ids.map((id) => (r[g][id] ?? 0).toFixed(2)),
            sum(r[g], ids).toFixed(2),
          ]),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `budget-ledger-${range}-${currentShiftDate()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Shared bits ───────────────────────────────────────────────────────────
  const track: React.CSSProperties = {
    display: "flex",
    gap: 4,
    background: m3.track,
    borderRadius: 20,
    padding: 4,
    flexShrink: 0,
  };
  const seg = (on: boolean): React.CSSProperties => ({
    height: 36,
    padding: "0 14px",
    border: "none",
    borderRadius: 16,
    fontSize: 12,
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
    background: on ? T.sel : "transparent",
    color: on ? T.onSel : T.textDim,
    fontWeight: on ? 700 : 500,
  });
  const headCell = (right: boolean): React.CSSProperties => ({
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 600,
    letterSpacing: 0.5,
    color: T.textDim,
    textAlign: right ? "right" : "left",
  });

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflowY: isMobile ? "auto" : undefined,
      }}
    >
      {/* Header row */}
      <div
        className="bp-no-scrollbar"
        style={{
          padding: isMobile ? "12px 12px 4px" : "20px 20px 4px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        <span
          style={{
            fontSize: 22,
            lineHeight: "28px",
            fontWeight: 600,
            color: T.text,
          }}
        >
          Budget
        </span>
        {seedDate && (
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 12,
              fontWeight: 600,
              color: m3.onOkContainer,
              background: m3.okContainer,
              padding: "6px 14px",
              borderRadius: 20,
              whiteSpace: "nowrap",
            }}
          >
            Opening balance · {shortDate(seedDate).date}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <div role="group" aria-label="Range" style={track}>
          {RANGES.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={range === id}
              onClick={() => setRange(id)}
              style={{
                ...seg(range === id),
                ...(range === id && {
                  background: m3.containerHighest,
                  color: T.text,
                }),
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          disabled={visible.length === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 44,
            padding: "0 20px",
            border: "none",
            borderRadius: 22,
            background: m3.containerHigh,
            color: T.text,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: visible.length === 0 ? "default" : "pointer",
            opacity: visible.length === 0 ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <svg
            viewBox="0 0 16 16"
            width={15}
            height={15}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
          >
            <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />
          </svg>
          Export
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: isMobile ? 12 : "16px 20px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Balance tiles */}
        {latest && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : `repeat(${cats.length + 1}, minmax(0, 1fr))`,
              gap: 14,
              flexShrink: 0,
            }}
          >
            {[
              ...cats.map((c) => ({
                label: c.label,
                value: latest.ending[c.id] ?? 0,
                delta:
                  (latest.incoming[c.id] ?? 0) - (latest.expenses[c.id] ?? 0),
                hero: false,
              })),
              {
                label: "Total budget",
                value: latest.endTotal,
                delta: latest.incTotal - latest.expTotal,
                hero: true,
              },
            ].map((t) => {
              const neg = t.value < 0;
              return (
                <div
                  key={t.label}
                  style={{
                    borderRadius: 20,
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    background: t.hero
                      ? m3.primaryContainer
                      : neg
                        ? m3.badTint
                        : m3.container,
                    boxShadow: t.hero ? m3.elev2 : m3.elev1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: t.hero ? 600 : 500,
                      color: t.hero
                        ? m3.onPrimaryContainer
                        : neg
                          ? m3.onBadContainer
                          : T.textDim,
                    }}
                  >
                    {t.label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 24,
                      lineHeight: "32px",
                      fontWeight: 700,
                      color: t.hero
                        ? m3.onPrimaryContainerStrong
                        : neg
                          ? T.bad
                          : T.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {peso(t.value)}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 12,
                      color: t.hero
                        ? m3.onPrimaryContainer
                        : t.delta < 0
                          ? T.bad
                          : m3.onOkContainer,
                    }}
                  >
                    {signed(t.delta)} on {shortDate(latest.date).date}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Ledger card */}
        <section
          aria-label="Running ledger"
          style={{
            flex: 1,
            minHeight: isMobile ? 360 : 0,
            background: m3.container,
            borderRadius: 24,
            boxShadow: m3.elev1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            className="bp-no-scrollbar"
            style={{
              padding: "16px 20px 10px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexShrink: 0,
              overflowX: "auto",
            }}
          >
            <span
              style={{
                fontSize: 16,
                lineHeight: "24px",
                fontWeight: 600,
                color: T.text,
                whiteSpace: "nowrap",
              }}
            >
              Running ledger
            </span>
            {!isMobile && (
              <span
                style={{
                  fontSize: 12,
                  color: T.textMute,
                  whiteSpace: "nowrap",
                }}
              >
                Ending = Starting + COGS/OPEX in − Expenses
              </span>
            )}
            <div style={{ flex: 1 }} />
            <div role="group" aria-label="Columns" style={track}>
              {MODES.map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={mode === id}
                  onClick={() => setMode(id)}
                  style={seg(mode === id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="bp-no-scrollbar"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              padding: "0 12px 12px",
            }}
          >
            <div
              style={{
                minWidth: isMobile ? 120 + headers.length * 118 : undefined,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  gap: 8,
                  padding: "10px 14px",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: m3.container,
                }}
              >
                <span style={headCell(false)}>Date</span>
                {headers.map((h) => (
                  <span key={h} style={headCell(true)}>
                    {h}
                  </span>
                ))}
              </div>

              {visible.length === 0 ? (
                <div
                  style={{
                    padding: "28px 14px",
                    fontSize: 13,
                    color: T.textMute,
                  }}
                >
                  {loading
                    ? "Loading ledger…"
                    : "No ledger days in this range."}
                </div>
              ) : (
                visible.map((r, i) => {
                  const d = shortDate(r.date);
                  return (
                    <div
                      key={r.date}
                      style={{
                        display: "grid",
                        gridTemplateColumns: cols,
                        gap: 8,
                        alignItems: "center",
                        padding: "13px 14px",
                        borderRadius: 14,
                        background:
                          i % 2 === 0 ? m3.containerHigh : "transparent",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: T.mono,
                            fontSize: 13,
                            fontWeight: 600,
                            color: T.text,
                          }}
                        >
                          {d.date}
                        </span>
                        <span style={{ fontSize: 12, color: T.textMute }}>
                          {d.dow}
                        </span>
                        {latest && r.date === latest.date && (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 8,
                              background: m3.okContainer,
                              color: m3.onOkContainer,
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            Latest
                          </span>
                        )}
                      </span>
                      {cellsFor(r).map((c, j) => (
                        <span
                          key={j}
                          style={{
                            fontFamily: T.mono,
                            fontSize: 14,
                            textAlign: "right",
                            color: c.color,
                            fontWeight: c.bold ? 700 : 500,
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.text}
                        </span>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div
            style={{
              padding: "10px 24px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 16 16"
              width={14}
              height={14}
              fill="none"
              stroke={T.textMute}
              strokeWidth={1.5}
            >
              <circle cx="8" cy="8" r="6" />
              <path d="M8 7.2v3.3M8 5.3v.1" />
            </svg>
            <span style={{ fontSize: 12, color: T.textMute }}>
              OPEX gets its daily allocation only on days the venue had sales or
              expenses. Closed days are skipped.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
