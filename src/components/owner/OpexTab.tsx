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
  };

  const fieldLabelStyle = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.10em",
    textTransform: "uppercase" as const,
    color: T.textMute,
    marginBottom: 4,
  };

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
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 100px 120px 130px 90px",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: T.textMute,
                  marginBottom: 4,
                }}
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
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: T.textMute,
                  marginBottom: 4,
                }}
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
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: T.textMute,
                  marginBottom: 4,
                }}
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
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    color: T.textMute,
                    marginBottom: 4,
                  }}
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
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    color: T.textMute,
                    marginBottom: 4,
                  }}
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

      <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>
        {/* Left: OPEX items list */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            borderRight: `1px solid ${T.line}`,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px 120px 90px 68px",
              padding: "0 16px",
              height: 36,
              alignItems: "center",
              borderBottom: `1px solid ${T.line}`,
              background: T.surface2,
              flexShrink: 0,
            }}
          >
            {["Name", "Type", "Amount", "Band Day", ""].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: T.headerText,
                }}
              >
                {h}
              </span>
            ))}
          </div>
          <div
            className="bp-no-scrollbar"
            style={{ flex: 1, overflowY: "auto" }}
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
                      gridTemplateColumns: "1fr 110px 120px 90px 68px",
                      padding: "0 16px",
                      height: 44,
                      alignItems: "center",
                      borderBottom: `1px solid ${T.line}`,
                      background: i % 2 === 0 ? "transparent" : T.surface,
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
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "transparent",
                          border: `1px solid ${T.line2}`,
                          color: item.isActive ? T.ok : T.textMute,
                          borderRadius: T.radius,
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
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "transparent",
                          border: `1px solid ${T.line2}`,
                          color: T.textDim,
                          borderRadius: T.radius,
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
                        padding: "10px 16px",
                        background: T.surface2,
                        borderBottom: `1px solid ${T.line}`,
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-end",
                      }}
                    >
                      <div style={{ width: 120 }}>
                        <div style={fieldLabelStyle}>New Amount ₱</div>
                        <input
                          value={eAmt}
                          onChange={(e) => setEAmt(e.target.value)}
                          type="number"
                          min="0"
                          style={{ ...inputStyle, fontFamily: T.mono }}
                        />
                      </div>
                      <div style={{ width: 150 }}>
                        <div style={fieldLabelStyle}>Effective From</div>
                        <input
                          value={eFrom}
                          onChange={(e) => setEFrom(e.target.value)}
                          type="month"
                          style={{ ...inputStyle, fontFamily: T.mono }}
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
                        }}
                      >
                        Cancel
                      </button>
                      <span
                        style={{
                          fontSize: 11,
                          color: err ? T.bad : T.textMute,
                          paddingBottom: 6,
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
                padding: "10px 16px",
                borderTop: `1px solid ${T.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, color: T.textMute }}>
                {visibleItems.filter((i) => i.isActive).length} active items
              </span>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.headerText,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
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
            padding: "16px",
          }}
        >
          {/* Month nav */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
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
              }}
            >
              ‹
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
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
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: T.headerText,
                }}
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
                        background: T.surface,
                        border: `1px solid ${T.line2}`,
                        color: T.text,
                        borderRadius: T.radius,
                        padding: "4px 6px",
                        outline: "none",
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
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: T.textMute,
                  marginBottom: 10,
                }}
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
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: T.text }}
                  >
                    Daily Total
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 15,
                      fontWeight: 700,
                      color: T.ok,
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
