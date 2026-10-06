"use client";

import { useTheme } from "@/lib/ThemeContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  ViewMode,
  localDateStr,
  weekBounds,
  navigateDay,
  navigateWeek,
  navigateMonth,
  todayLabel,
  MONTH_NAMES,
  parseLocalDate,
  currentShiftDate,
} from "@/lib/dateNav";

interface DateRangeNavProps {
  mode: ViewMode;
  // today mode
  date: string;
  // week mode
  weekRef: Date;
  // month mode
  month: number;
  year: number;
  onModeChange: (m: ViewMode) => void;
  onDateChange: (d: string) => void;
  onWeekChange: (ref: Date) => void;
  onMonthChange: (year: number, month: number) => void;
}

export default function DateRangeNav({
  mode,
  date,
  weekRef,
  month,
  year,
  onModeChange,
  onDateChange,
  onWeekChange,
  onMonthChange,
}: DateRangeNavProps) {
  const { T } = useTheme();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const m3 = T.m3;

  const btnBase: React.CSSProperties = {
    padding: isMobile ? "10px 14px" : "5px 14px",
    minHeight: isMobile ? 44 : undefined,
    fontSize: 12,
    fontFamily: "inherit",
    border: `1px solid ${T.line2}`,
    borderRadius: T.radius,
    cursor: "pointer",
    lineHeight: 1,
    ...(m3 && {
      border: "none",
      borderRadius: 16,
      padding: isMobile ? "10px 16px" : "0 16px",
      minHeight: isMobile ? 44 : 34,
      fontWeight: 500,
    }),
  };
  const activeBtn: React.CSSProperties = {
    ...btnBase,
    background: T.sel,
    color: T.onSel,
    borderColor: T.sel,
    fontWeight: 600,
  };
  const inactiveBtn: React.CSSProperties = {
    ...btnBase,
    background: m3 ? "transparent" : T.chip,
    color: T.textDim,
    fontWeight: m3 ? 500 : 400,
  };
  // Secondary "jump back" buttons (Today / This Week / This Month).
  const jumpBtn: React.CSSProperties = m3
    ? {
        ...inactiveBtn,
        background: m3.containerHigh,
        color: T.text,
        borderRadius: 999,
        padding: "0 12px",
        minHeight: isMobile ? 44 : 32,
        fontSize: 12,
        whiteSpace: "nowrap",
      }
    : { ...inactiveBtn, padding: "3px 8px", fontSize: 11 };

  // Date input / select styling.
  const fieldStyle = (mobileTall: boolean): React.CSSProperties =>
    m3
      ? {
          padding: "0 12px",
          minHeight: isMobile ? 44 : 36,
          fontSize: 13,
          fontFamily: T.mono,
          background: m3.containerHigh,
          color: T.text,
          border: "none",
          borderRadius: 12,
          outline: "none",
          cursor: "pointer",
        }
      : {
          padding: mobileTall && isMobile ? "10px 8px" : "4px 8px",
          minHeight: mobileTall && isMobile ? 44 : undefined,
          fontSize: 12,
          fontFamily: T.mono,
          background: T.surface2,
          color: T.text,
          border: `1px solid ${T.line2}`,
          borderRadius: T.radius,
          outline: "none",
          cursor: "pointer",
        };

  const navBtn: React.CSSProperties = {
    width: isMobile ? 44 : 28,
    height: isMobile ? 44 : 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: T.chip,
    border: `1px solid ${T.line2}`,
    borderRadius: T.radius,
    cursor: "pointer",
    color: T.textDim,
    fontSize: isMobile ? 18 : 14,
    lineHeight: 1,
    flexShrink: 0,
    ...(m3 && {
      width: isMobile ? 44 : 36,
      height: isMobile ? 44 : 36,
      background: m3.containerHigh,
      border: "none",
      borderRadius: "50%",
      color: T.text,
      fontSize: isMobile ? 20 : 18,
    }),
  };

  function handlePrev() {
    if (mode === "today") onDateChange(navigateDay(date, -1));
    else if (mode === "week") onWeekChange(navigateWeek(weekRef, -1));
    else {
      const { year: y, month: m } = navigateMonth(year, month, -1);
      onMonthChange(y, m);
    }
  }

  function handleNext() {
    if (mode === "today") onDateChange(navigateDay(date, 1));
    else if (mode === "week") onWeekChange(navigateWeek(weekRef, 1));
    else {
      const { year: y, month: m } = navigateMonth(year, month, 1);
      onMonthChange(y, m);
    }
  }

  // Center label / picker
  function CenterControl() {
    if (mode === "today") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            style={fieldStyle(true)}
          />
          {date !== localDateStr(new Date()) && (
            <button
              onClick={() => onDateChange(localDateStr(new Date()))}
              style={jumpBtn}
            >
              Today
            </button>
          )}
        </div>
      );
    }

    if (mode === "week") {
      const { label, start: weekStartISO } = weekBounds(weekRef);
      const weekStartStr = localDateStr(new Date(weekStartISO));
      const todayWeekStr = localDateStr(new Date(weekBounds(new Date()).start));
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date"
            value={weekStartStr}
            title={label}
            onChange={(e) =>
              e.target.value && onWeekChange(parseLocalDate(e.target.value))
            }
            style={fieldStyle(true)}
          />
          <span
            style={{
              fontSize: 11,
              fontFamily: T.mono,
              color: T.textDim,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
          {weekStartStr !== todayWeekStr && (
            <button onClick={() => onWeekChange(new Date())} style={jumpBtn}>
              This Week
            </button>
          )}
        </div>
      );
    }

    // month
    const todayDate = new Date();
    const isCurrentMonth =
      year === todayDate.getFullYear() && month === todayDate.getMonth();
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <select
          value={month}
          onChange={(e) => onMonthChange(year, parseInt(e.target.value))}
          style={fieldStyle(false)}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => onMonthChange(parseInt(e.target.value), month)}
          style={fieldStyle(false)}
        >
          {[todayDate.getFullYear() - 1, todayDate.getFullYear()].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {!isCurrentMonth && (
          <button
            onClick={() =>
              onMonthChange(todayDate.getFullYear(), todayDate.getMonth())
            }
            style={jumpBtn}
          >
            This Month
          </button>
        )}
      </div>
    );
  }

  // Jump to today's week / month when switching modes
  function handleModeChange(m: ViewMode) {
    const now = new Date();
    if (m === "today") onDateChange(localDateStr(now));
    else if (m === "week") onWeekChange(now);
    else onMonthChange(now.getFullYear(), now.getMonth());
    onModeChange(m);
  }

  return (
    <div
      className={isMobile ? "bp-no-scrollbar" : ""}
      style={{
        display: "flex",
        alignItems: "center",
        gap: m3 ? 10 : 8,
        overflowX: "auto",
        touchAction: "pan-x pan-y",
      }}
    >
      {/* Mode pills */}
      <div
        style={{
          display: "flex",
          gap: 2,
          ...(m3 && {
            gap: 4,
            padding: 3,
            background: m3.track,
            borderRadius: 18,
            flexShrink: 0,
          }),
        }}
      >
        {(["today", "week", "month"] as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            style={mode === m ? activeBtn : inactiveBtn}
          >
            {m === "today" ? "Today" : m === "week" ? "Week" : "Month"}
          </button>
        ))}
      </div>

      {!m3 && <div style={{ width: 1, height: 20, background: T.line2 }} />}

      {/* Prev / center / next */}
      <button onClick={handlePrev} style={navBtn}>
        ‹
      </button>
      <CenterControl />
      <button onClick={handleNext} style={navBtn}>
        ›
      </button>
    </div>
  );
}

// ── Hook: manage all date nav state in one place ──────────────────────────────
export function useDateNav() {
  const now = new Date();
  const [mode, setMode] = useState<ViewMode>("today");
  const [date, setDate] = useState(currentShiftDate());
  const [weekRef, setWeekRef] = useState<Date>(now);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  return {
    mode,
    setMode,
    date,
    setDate,
    weekRef,
    setWeekRef,
    month,
    year,
    setMonth: (y: number, m: number) => {
      setYear(y);
      setMonth(m);
    },
  };
}

// useState import needed in this file
import { useState } from "react";
