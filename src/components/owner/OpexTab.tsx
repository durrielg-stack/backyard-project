"use client";

import { useTheme } from "@/lib/ThemeContext";
import { Fragment, useState, useEffect, useCallback } from "react";
import { getClient } from "@/lib/supabase";
import { SectionHd, fmtPeso } from "./ownerShared";
import {
  itemsForMonth,
  effectiveLabel,
  monthStart,
  previousMonthStart,
} from "@/lib/opex";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OpexItem {
  id: number;
  name: string;
  type: "monthly_fixed" | "band" | "daily_flat";
  amount: number;
  bandDay: "friday" | "saturday" | null;
  notes: string | null;
  isActive: boolean;
  // Month-start strings, both inclusive; effectiveTo null = open-ended.
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface MonthConfig {
  id: number | null;
  year: number;
  month: number;
  workingDays: number;
  fridays: number;
  saturdays: number;
}

const TYPE_LABELS: Record<string, string> = {
  monthly_fixed: "Monthly Fixed",
  band: "Band",
  daily_flat: "Daily Flat",
};

const MONTH_NAMES = [
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

// ── OPEX allocation helpers ────────────────────────────────────────────────────

export function computeMonthlyOpex(
  items: OpexItem[],
  cfg: MonthConfig | null,
): number {
  if (!cfg || cfg.workingDays === 0) return 0;
  let total = 0;
  for (const item of itemsForMonth(items, cfg.year, cfg.month)) {
    if (!item.isActive) continue;
    if (item.type === "monthly_fixed") total += item.amount;
    else if (item.type === "band") {
      const days = item.bandDay === "friday" ? cfg.fridays : cfg.saturdays;
      total += item.amount * days;
    } else if (item.type === "daily_flat") {
      total += item.amount * cfg.workingDays;
    }
  }
  return total;
}

export function computeDailyOpex(
  items: OpexItem[],
  cfg: MonthConfig | null,
): number {
  if (!cfg || cfg.workingDays === 0) return 0;
  return computeMonthlyOpex(items, cfg) / cfg.workingDays;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OpexTab() {
  const { T } = useTheme();
  const m3 = T.m3;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [items, setItems] = useState<OpexItem[]>([]);
  const [cfg, setCfg] = useState<MonthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add form state
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState<OpexItem["type"]>("monthly_fixed");
  const [fAmt, setFAmt] = useState("");
  const [fBand, setFBand] = useState<"friday" | "saturday">("friday");
  const [fNotes, setFNotes] = useState("");
  const [fFrom, setFFrom] = useState("");

  // Amount-change state: a new amount from a chosen month onward.
  const [editId, setEditId] = useState<number | null>(null);
  const [eAmt, setEAmt] = useState("");
  const [eFrom, setEFrom] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Monthly config edit state
  const [cfgEdit, setCfgEdit] = useState(false);
  const [fWd, setFWd] = useState("");
  const [fFri, setFFri] = useState("");
  const [fSat, setFSat] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: itemRows }, { data: cfgRow }] = await Promise.all([
      sb.from("opex_items").select("*").order("type").order("name"),
      sb
        .from("opex_monthly_config")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle(),
    ]);
    setItems(
      (itemRows ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        amount: r.amount,
        bandDay: r.band_day ?? null,
        notes: r.notes ?? null,
        isActive: r.is_active,
        effectiveFrom: r.effective_from,
        effectiveTo: r.effective_to ?? null,
      })),
    );
    if (cfgRow) {
      setCfg({
        id: cfgRow.id,
        year: cfgRow.year,
        month: cfgRow.month,
        workingDays: cfgRow.working_days,
        fridays: cfgRow.fridays,
        saturdays: cfgRow.saturdays,
      });
      setFWd(String(cfgRow.working_days));
      setFFri(String(cfgRow.fridays));
      setFSat(String(cfgRow.saturdays));
    } else {
      setCfg(null);
      setFWd("");
      setFFri("");
      setFSat("");
    }
    setLoading(false);
  }, [sb, year, month]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const viewedMonthInput = `${year}-${String(month).padStart(2, "0")}`;

  useEffect(() => {
    setFFrom(viewedMonthInput);
    setEditId(null);
    setErr(null);
  }, [viewedMonthInput]);

  function shiftMonth(delta: number) {
    let m = month + delta,
      y = year;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (m < 1) {
      m = 12;
      y--;
    }
    setMonth(m);
    setYear(y);
  }

  async function saveConfig() {
    const wd = parseInt(fWd),
      fri = parseInt(fFri),
      sat = parseInt(fSat);
    if (isNaN(wd) || wd < 1 || isNaN(fri) || isNaN(sat)) return;
    setSaving(true);
    if (cfg?.id) {
      await sb
        .from("opex_monthly_config")
        .update({ working_days: wd, fridays: fri, saturdays: sat })
        .eq("id", cfg.id);
    } else {
      await sb.from("opex_monthly_config").insert({
        year,
        month,
        working_days: wd,
        fridays: fri,
        saturdays: sat,
      });
    }
    setCfgEdit(false);
    await fetchAll();
    setSaving(false);
  }

  async function addItem() {
    const amt = parseFloat(fAmt);
    if (!fName.trim() || isNaN(amt) || amt < 0) return;
    setSaving(true);
    const [fy, fm] = (fFrom || viewedMonthInput).split("-").map(Number);
    const { error } = await sb.from("opex_items").insert({
      name: fName.trim(),
      type: fType,
      amount: amt,
      band_day: fType === "band" ? fBand : null,
      notes: fNotes.trim() || null,
      effective_from: monthStart(fy, fm),
    });
    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }
    setFName("");
    setFAmt("");
    setFNotes("");
    setFType("monthly_fixed");
    setShowForm(false);
    await fetchAll();
    setSaving(false);
  }

  function startEdit(item: OpexItem) {
    setErr(null);
    setEditId(item.id);
    setEAmt(String(item.amount));
    setEFrom(viewedMonthInput);
  }

  // Changing an amount from a later month splits the item into two versions so
  // months that already closed keep the figure they were reported at.
  async function saveEdit(item: OpexItem) {
    const amt = parseFloat(eAmt);
    if (isNaN(amt) || amt < 0) return;
    const [ey, em] = eFrom.split("-").map(Number);
    if (!ey || !em) return;
    const from = monthStart(ey, em);
    if (from < item.effectiveFrom) {
      setErr("Effective month cannot precede this version's own start month.");
      return;
    }
    setSaving(true);
    setErr(null);
    if (from === item.effectiveFrom) {
      // Same era — correcting this version's figure in place.
      const { error } = await sb
        .from("opex_items")
        .update({ amount: amt })
        .eq("id", item.id);
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: closeErr } = await sb
        .from("opex_items")
        .update({ effective_to: previousMonthStart(ey, em) })
        .eq("id", item.id);
      if (closeErr) {
        setErr(closeErr.message);
        setSaving(false);
        return;
      }
      const { error: openErr } = await sb.from("opex_items").insert({
        name: item.name,
        type: item.type,
        amount: amt,
        band_day: item.bandDay,
        notes: item.notes,
        is_active: item.isActive,
        effective_from: from,
        effective_to: item.effectiveTo,
      });
      if (openErr) {
        // Roll the close back so the item never disappears from later months.
        await sb
          .from("opex_items")
          .update({ effective_to: item.effectiveTo })
          .eq("id", item.id);
        setErr(openErr.message);
        setSaving(false);
        return;
      }
    }
    setEditId(null);
    await fetchAll();
    setSaving(false);
  }

  async function toggleActive(item: OpexItem) {
    await sb
      .from("opex_items")
      .update({ is_active: !item.isActive })
      .eq("id", item.id);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isActive: !i.isActive } : i)),
    );
  }

  async function deleteItem(id: number) {
    await sb.from("opex_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const monthlyTotal = computeMonthlyOpex(items, cfg);
  const dailyAlloc = computeDailyOpex(items, cfg);
  // Only the versions that govern the viewed month; stepping the month nav is
  // how the owner sees an item's history.
  const visibleItems = itemsForMonth(items, year, month);
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const inputStyle = {
    fontFamily: "inherit",
    fontSize: 12,
    background: T.surface,
    border: `1px solid ${T.line2}`,
    color: T.text,
    borderRadius: T.radius,
    padding: "6px 8px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    ...(m3 && {
      fontSize: 13,
      background: m3.containerHigh,
      border: "none",
      borderRadius: 12,
      minHeight: 40,
      padding: "0 12px",
    }),
  };

  const fieldLabelStyle = m3
    ? { fontSize: 12, fontWeight: 500, color: T.textDim, marginBottom: 6 }
    : {
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.10em",
        textTransform: "uppercase" as const,
        color: T.textMute,
        marginBottom: 4,
      };
  // M3 card shell for the list, form and side cards.
  const m3Card: React.CSSProperties = m3
    ? {
        background: m3.container,
        border: "none",
        borderRadius: 24,
        boxShadow: m3.elev1,
      }
    : {};
  const m3Secondary: React.CSSProperties = m3
    ? {
        background: m3.containerHigh,
        color: T.text,
        border: "none",
        borderRadius: 20,
        minHeight: 40,
        padding: "0 16px",
        fontSize: 13,
        fontWeight: 500,
      }
    : {};
  const m3Primary: React.CSSProperties = m3
    ? {
        background: T.accent,
        color: T.accentInk,
        border: "none",
        borderRadius: 20,
        minHeight: 40,
        padding: "0 18px",
        fontSize: 13,
        fontWeight: 600,
      }
    : {};

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "auto",
      }}
    >
      <SectionHd
        title="OPEX Calculator"
        badge={
          cfg
            ? `₱${dailyAlloc.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day`
            : "No config"
        }
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              padding: "5px 14px",
              fontSize: 12,
              fontFamily: "inherit",
              fontWeight: 600,
              background: showForm ? T.chip : T.accent,
              color: showForm ? T.textDim : T.accentInk,
              border: `1px solid ${showForm ? T.line2 : T.accent}`,
              borderRadius: T.radius,
              cursor: "pointer",
              ...(showForm ? m3Secondary : m3Primary),
            }}
          >
            {showForm ? "Cancel" : "+ Add Item"}
          </button>
        }
      />

      {/* Add item form */}
      {showForm && (
        <div
          style={{
            padding: "16px 24px",
            background: T.surface2,
            borderBottom: `1px solid ${T.line}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
            ...(m3 && {
              ...m3Card,
              margin: "0 20px 16px",
              padding: "16px 20px",
              gap: 12,
            }),
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 100px 120px 130px 90px",
              gap: m3 ? 10 : 8,
              alignItems: "end",
            }}
          >
            <div>
              <div
                style={
                  m3
                    ? fieldLabelStyle
                    : {
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: T.textMute,
                        marginBottom: 4,
                      }
                }
              >
                Name *
              </div>
              <input
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="e.g. Rent"
                style={inputStyle}
              />
            </div>
            <div>
              <div
                style={
                  m3
                    ? fieldLabelStyle
                    : {
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: T.textMute,
                        marginBottom: 4,
                      }
                }
              >
                Type
              </div>
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value as OpexItem["type"])}
                style={inputStyle}
              >
                <option value="monthly_fixed">Monthly Fixed</option>
                <option value="band">Band (Fri/Sat)</option>
                <option value="daily_flat">Daily Flat</option>
              </select>
            </div>
            <div>
              <div
                style={
                  m3
                    ? fieldLabelStyle
                    : {
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: T.textMute,
                        marginBottom: 4,
                      }
                }
              >
                Amount ₱
              </div>
              <input
                value={fAmt}
                onChange={(e) => setFAmt(e.target.value)}
                placeholder="0.00"
                type="number"
                min="0"
                style={{ ...inputStyle, fontFamily: T.mono }}
              />
            </div>
            {fType === "band" ? (
              <div>
                <div
                  style={
                    m3
                      ? fieldLabelStyle
                      : {
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.10em",
                          textTransform: "uppercase",
                          color: T.textMute,
                          marginBottom: 4,
                        }
                  }
                >
                  Band Day
                </div>
                <select
                  value={fBand}
                  onChange={(e) =>
                    setFBand(e.target.value as "friday" | "saturday")
                  }
                  style={inputStyle}
                >
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                </select>
              </div>
            ) : (
              <div>
                <div
                  style={
                    m3
                      ? fieldLabelStyle
                      : {
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.10em",
                          textTransform: "uppercase",
                          color: T.textMute,
                          marginBottom: 4,
                        }
                  }
                >
                  Notes
                </div>
                <input
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>
            )}
            <div>
              <div style={fieldLabelStyle}>Effective From</div>
              <input
                value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
                type="month"
                style={{ ...inputStyle, fontFamily: T.mono }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                onClick={addItem}
                disabled={saving || !fName.trim() || !fAmt}
                style={{
                  width: "100%",
                  padding: "7px 0",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 700,
                  background: T.accent,
                  color: T.accentInk,
                  border: "none",
                  borderRadius: T.radius,
                  cursor: "pointer",
                  opacity: !fName.trim() || !fAmt ? 0.4 : 1,
                  ...m3Primary,
                }}
              >
                Save
              </button>
            </div>
          </div>
          {err && editId === null && (
            <div style={{ fontSize: 11, color: T.bad }}>{err}</div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: m3 ? 16 : 0,
          flex: 1,
          minHeight: 0,
          ...(m3 && { padding: "0 20px 20px" }),
        }}
      >
        {/* Left: OPEX items list */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            borderRight: `1px solid ${T.line}`,
            ...(m3 && { ...m3Card, overflow: "hidden" }),
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: m3
                ? "1fr 110px 120px 90px 76px"
                : "1fr 110px 120px 90px 68px",
              padding: m3 ? "0 20px" : "0 16px",
              height: m3 ? 48 : 36,
              alignItems: "center",
              borderBottom: m3 ? "none" : `1px solid ${T.line}`,
              background: m3 ? "transparent" : T.surface2,
              flexShrink: 0,
            }}
          >
            {["Name", "Type", "Amount", "Band Day", ""].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: m3 ? 11 : 10,
                  fontWeight: 600,
                  letterSpacing: m3 ? "0.04em" : "0.12em",
                  textTransform: "uppercase",
                  color: m3 ? T.textMute : T.headerText,
                }}
              >
                {h}
              </span>
            ))}
          </div>
          <div
            className="bp-no-scrollbar"
            style={{
              flex: 1,
              overflowY: "auto",
              ...(m3 && { padding: "0 8px 8px" }),
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: 24,
                  color: T.textMute,
                  fontFamily: T.mono,
                  fontSize: 12,
                }}
              >
                Loading…
              </div>
            ) : visibleItems.length === 0 ? (
              <div
                style={{
                  padding: "32px 24px",
                  color: T.textMute,
                  fontFamily: T.mono,
                  fontSize: 12,
                }}
              >
                No OPEX items effective in {monthLabel} — add one above.
              </div>
            ) : (
              visibleItems.map((item, i) => (
                <Fragment key={item.id}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: m3
                        ? "1fr 110px 120px 90px 76px"
                        : "1fr 110px 120px 90px 68px",
                      padding: m3 ? "0 12px" : "0 16px",
                      height: m3 ? 52 : 44,
                      alignItems: "center",
                      borderBottom: m3 ? "none" : `1px solid ${T.line}`,
                      background: m3
                        ? i % 2 === 0
                          ? m3.containerHigh
                          : "transparent"
                        : i % 2 === 0
                          ? "transparent"
                          : T.surface,
                      ...(m3 && { borderRadius: 14 }),
                      opacity: item.isActive ? 1 : 0.4,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: T.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </div>
                      {effectiveLabel(item) && (
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: T.mono,
                            color: T.textMute,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {effectiveLabel(item)}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: T.textDim }}>
                      {TYPE_LABELS[item.type]}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 13,
                        color: T.ok,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtPeso(item.amount)}
                      {item.type === "daily_flat"
                        ? "/day"
                        : item.type === "band"
                          ? "/day"
                          : ""}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: T.textMute,
                        textTransform: "capitalize",
                      }}
                    >
                      {item.type === "band" ? (item.bandDay ?? "—") : "—"}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => toggleActive(item)}
                        title={item.isActive ? "Deactivate" : "Activate"}
                        style={{
                          width: m3 ? 32 : 28,
                          height: m3 ? 32 : 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: m3 ? m3.containerHighest : "transparent",
                          border: m3 ? "none" : `1px solid ${T.line2}`,
                          color: item.isActive ? T.ok : T.textMute,
                          borderRadius: m3 ? 16 : T.radius,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        {item.isActive ? "●" : "○"}
                      </button>
                      <button
                        onClick={() => startEdit(item)}
                        title="Change amount from a month onward"
                        style={{
                          width: m3 ? 32 : 28,
                          height: m3 ? 32 : 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: m3 ? m3.containerHighest : "transparent",
                          border: m3 ? "none" : `1px solid ${T.line2}`,
                          color: T.textDim,
                          borderRadius: m3 ? 16 : T.radius,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        ✎
                      </button>
                    </div>
                  </div>
                  {editId === item.id && (
                    <div
                      style={{
                        padding: m3 ? "12px 16px" : "10px 16px",
                        background: m3 ? m3.containerHigh : T.surface2,
                        borderBottom: m3 ? "none" : `1px solid ${T.line}`,
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-end",
                        ...(m3 && { borderRadius: 16, margin: "4px 0 8px" }),
                      }}
                    >
                      <div style={{ width: 120 }}>
                        <div style={fieldLabelStyle}>New Amount ₱</div>
                        <input
                          value={eAmt}
                          onChange={(e) => setEAmt(e.target.value)}
                          type="number"
                          min="0"
                          style={{
                            ...inputStyle,
                            fontFamily: T.mono,
                            ...(m3 && { background: m3.containerHighest }),
                          }}
                        />
                      </div>
                      <div style={{ width: 150 }}>
                        <div style={fieldLabelStyle}>Effective From</div>
                        <input
                          value={eFrom}
                          onChange={(e) => setEFrom(e.target.value)}
                          type="month"
                          style={{
                            ...inputStyle,
                            fontFamily: T.mono,
                            ...(m3 && { background: m3.containerHighest }),
                          }}
                        />
                      </div>
                      <button
                        onClick={() => saveEdit(item)}
                        disabled={saving || !eAmt}
                        style={{
                          padding: "7px 16px",
                          fontSize: 12,
                          fontFamily: "inherit",
                          fontWeight: 700,
                          background: T.accent,
                          color: T.accentInk,
                          border: "none",
                          borderRadius: T.radius,
                          cursor: "pointer",
                          opacity: !eAmt ? 0.4 : 1,
                          ...m3Primary,
                        }}
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => {
                          setEditId(null);
                          setErr(null);
                        }}
                        style={{
                          padding: "7px 14px",
                          fontSize: 12,
                          fontFamily: "inherit",
                          background: T.chip,
                          color: T.textDim,
                          border: `1px solid ${T.line2}`,
                          borderRadius: T.radius,
                          cursor: "pointer",
                          ...m3Secondary,
                          ...(m3 && { background: m3.containerHighest }),
                        }}
                      >
                        Cancel
                      </button>
                      <span
                        style={{
                          fontSize: 11,
                          color: err ? T.bad : T.textMute,
                          paddingBottom: m3 ? 12 : 6,
                        }}
                      >
                        {err ?? "Earlier months keep the current amount."}
                      </span>
                    </div>
                  )}
                </Fragment>
              ))
            )}
          </div>

          {/* Totals footer */}
          {visibleItems.filter((i) => i.isActive).length > 0 && (
            <div
              style={{
                padding: m3 ? "12px 20px 16px" : "10px 16px",
                borderTop: m3 ? "none" : `1px solid ${T.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: m3 ? 12 : 11,
                  color: m3 ? T.textDim : T.textMute,
                }}
              >
                {visibleItems.filter((i) => i.isActive).length} active items
              </span>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={
                      m3
                        ? { fontSize: 12, fontWeight: 500, color: T.textDim }
                        : {
                            fontSize: 10,
                            color: T.headerText,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }
                    }
                  >
                    Monthly Total
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 15,
                      fontWeight: 700,
                      color: T.ok,
                    }}
                  >
                    {fmtPeso(monthlyTotal)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Monthly config + daily summary */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            padding: m3 ? 0 : "16px",
            ...(m3 && { width: 300, gap: 14 }),
          }}
        >
          {/* Month nav */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: m3 ? 0 : 12,
              ...(m3 && {
                ...m3Card,
                borderRadius: 20,
                padding: "8px 8px",
              }),
            }}
          >
            <button
              onClick={() => shiftMonth(-1)}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.chip,
                border: `1px solid ${T.line2}`,
                color: T.textDim,
                borderRadius: T.radius,
                cursor: "pointer",
                ...(m3 && {
                  width: 40,
                  height: 40,
                  background: m3.containerHigh,
                  border: "none",
                  color: T.text,
                  borderRadius: 20,
                  fontSize: 18,
                }),
              }}
            >
              ‹
            </button>
            <span
              style={{
                fontSize: m3 ? 15 : 13,
                fontWeight: m3 ? 600 : 700,
                color: T.text,
              }}
            >
              {monthLabel}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.chip,
                border: `1px solid ${T.line2}`,
                color: T.textDim,
                borderRadius: T.radius,
                cursor: "pointer",
                ...(m3 && {
                  width: 40,
                  height: 40,
                  background: m3.containerHigh,
                  border: "none",
                  color: T.text,
                  borderRadius: 20,
                  fontSize: 18,
                }),
              }}
            >
              ›
            </button>
          </div>

          {/* Monthly config card */}
          <div
            style={{
              background: T.surface2,
              border: `1px solid ${T.line}`,
              borderRadius: T.radiusLg,
              padding: 14,
              marginBottom: 12,
              ...(m3 && { ...m3Card, padding: "16px 20px", marginBottom: 0 }),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={
                  m3
                    ? { fontSize: 16, fontWeight: 600, color: T.text }
                    : {
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: T.headerText,
                      }
                }
              >
                Monthly Config
              </span>
              {!cfgEdit && (
                <button
                  onClick={() => setCfgEdit(true)}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    background: T.chip,
                    border: `1px solid ${T.line2}`,
                    color: T.textDim,
                    borderRadius: T.radius,
                    cursor: "pointer",
                    ...m3Secondary,
                    ...(m3 && {
                      minHeight: 32,
                      padding: "0 14px",
                      fontSize: 12,
                    }),
                  }}
                >
                  {cfg ? "Edit" : "Set Up"}
                </button>
              )}
            </div>

            {cfgEdit ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Working Days", val: fWd, set: setFWd },
                  { label: "Fridays", val: fFri, set: setFFri },
                  { label: "Saturdays", val: fSat, set: setFSat },
                ].map(({ label, val, set }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{ fontSize: 12, color: T.textDim, flexShrink: 0 }}
                    >
                      {label}
                    </span>
                    <input
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      type="number"
                      min="0"
                      style={{
                        width: 64,
                        fontFamily: T.mono,
                        fontSize: 13,
                        textAlign: "right",
                        background: m3 ? m3.containerHigh : T.surface,
                        border: m3 ? "none" : `1px solid ${T.line2}`,
                        color: T.text,
                        borderRadius: m3 ? 12 : T.radius,
                        padding: m3 ? "0 10px" : "4px 6px",
                        outline: "none",
                        ...(m3 && { minHeight: 40, width: 72 }),
                      }}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button
                    onClick={() => {
                      setCfgEdit(false);
                      fetchAll();
                    }}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      fontSize: 11,
                      fontFamily: "inherit",
                      background: T.chip,
                      color: T.textDim,
                      border: `1px solid ${T.line2}`,
                      borderRadius: T.radius,
                      cursor: "pointer",
                      ...m3Secondary,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveConfig}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      fontSize: 11,
                      fontFamily: "inherit",
                      fontWeight: 700,
                      background: T.accent,
                      color: T.accentInk,
                      border: "none",
                      borderRadius: T.radius,
                      cursor: "pointer",
                      ...m3Primary,
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : cfg ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["Working Days", cfg.workingDays],
                  ["Fridays", cfg.fridays],
                  ["Saturdays", cfg.saturdays],
                ].map(([label, val]) => (
                  <div
                    key={String(label)}
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ fontSize: 12, color: T.textDim }}>
                      {label}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 13,
                        color: T.text,
                        fontWeight: 600,
                      }}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: T.textMute }}>
                No config for {monthLabel} yet.
              </div>
            )}
          </div>

          {/* Daily allocation card */}
          {cfg && items.filter((i) => i.isActive).length > 0 && (
            <div
              style={{
                background: T.surface2,
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusLg,
                padding: 14,
                ...(m3 && { ...m3Card, padding: "16px 20px" }),
              }}
            >
              <div
                style={
                  m3
                    ? {
                        fontSize: 16,
                        fontWeight: 600,
                        color: T.text,
                        marginBottom: 12,
                      }
                    : {
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: T.textMute,
                        marginBottom: 10,
                      }
                }
              >
                Daily Allocation
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items
                  .filter((i) => i.isActive)
                  .map((item) => {
                    let contrib = 0;
                    if (item.type === "monthly_fixed")
                      contrib = item.amount / cfg.workingDays;
                    else if (item.type === "band") {
                      const days =
                        item.bandDay === "friday" ? cfg.fridays : cfg.saturdays;
                      contrib = (item.amount * days) / cfg.workingDays;
                    } else if (item.type === "daily_flat")
                      contrib = item.amount;
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: T.textDim,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 150,
                          }}
                        >
                          {item.name}
                        </span>
                        <span
                          style={{
                            fontFamily: T.mono,
                            fontSize: 12,
                            color: T.textDim,
                            fontVariantNumeric: "tabular-nums",
                            flexShrink: 0,
                          }}
                        >
                          {fmtPeso(contrib)}
                        </span>
                      </div>
                    );
                  })}
                <div
                  style={{
                    borderTop: `1px solid ${T.line}`,
                    paddingTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 2,
                    ...(m3 && {
                      borderTop: "none",
                      background: m3.primaryContainer,
                      borderRadius: 16,
                      padding: "12px 14px",
                      marginTop: 8,
                    }),
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: m3 ? 600 : 700,
                      color: m3 ? m3.onPrimaryContainer : T.text,
                    }}
                  >
                    Daily Total
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: m3 ? 18 : 15,
                      fontWeight: 700,
                      color: m3 ? m3.onPrimaryContainerStrong : T.ok,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtPeso(dailyAlloc)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
