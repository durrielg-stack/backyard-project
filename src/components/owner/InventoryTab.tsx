"use client";

import { useTheme } from "@/lib/ThemeContext";
import { useState, useCallback, useEffect } from "react";
import { getClient } from "@/lib/supabase";
import { SectionHd, SearchBox } from "./ownerShared";
import { useSortable } from "@/lib/useSortable";

interface InvRow {
  id: number;
  menuItemId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  lowStockThresh: number;
  updatedAt: string;
}

type StockFilter = "all" | "out" | "low" | "normal";

export default function InventoryTab() {
  const { T } = useTheme();
  const m3 = T.m3;

  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any;

  const fetchRows = useCallback(async () => {
    const { data } = await sb
      .from("inventory")
      .select(
        "id, menu_item_id, quantity, unit, low_stock_threshold, updated_at, menu_items(name, category)",
      )
      .order("id");
    setRows(
      (data ?? []).map((r: any) => {
        const mi = Array.isArray(r.menu_items) ? r.menu_items[0] : r.menu_items;
        return {
          id: r.id,
          menuItemId: r.menu_item_id,
          name: mi?.name ?? "—",
          category: mi?.category ?? "—",
          quantity: r.quantity,
          unit: r.unit,
          lowStockThresh: r.low_stock_threshold,
          updatedAt: r.updated_at,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  async function adjust(row: InvRow, delta: number) {
    const newQty = Math.max(0, row.quantity + delta);
    setSaving(row.id);
    await sb
      .from("inventory")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, quantity: newQty } : r)),
    );
    setSaving(null);
  }

  function level(row: InvRow): "out" | "low" | "normal" {
    if (row.quantity === 0) return "out";
    if (row.quantity <= row.lowStockThresh) return "low";
    return "normal";
  }

  const categories = Array.from(new Set(rows.map((r) => r.category))).sort();
  const catRows =
    catFilter === "all" ? rows : rows.filter((r) => r.category === catFilter);

  const outCount = catRows.filter((r) => level(r) === "out").length;
  const lowCount = catRows.filter((r) => level(r) === "low").length;
  const normalCount = catRows.filter((r) => level(r) === "normal").length;

  const stockRows =
    stockFilter === "all"
      ? catRows
      : catRows.filter((r) => level(r) === stockFilter);
  const visibleRows = search.trim()
    ? stockRows.filter((r) =>
        r.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : stockRows;
  const {
    sorted: sortedRows,
    toggle: sortToggle,
    icon: sortIcon,
  } = useSortable(visibleRows, "name" as keyof InvRow);

  const stockPill = (
    id: StockFilter,
    label: string,
    count: number,
    color: string,
  ) => {
    const m3Pair = m3
      ? id === "out"
        ? { bg: m3.badContainer, fg: m3.onBadContainer }
        : id === "low"
          ? { bg: m3.warnContainer, fg: m3.onWarnContainer }
          : { bg: m3.okContainer, fg: m3.onOkContainer }
      : null;
    return (
      <button
        key={id}
        onClick={() => setStockFilter((prev) => (prev === id ? "all" : id))}
        style={{
          padding: "4px 12px",
          fontSize: 11,
          fontFamily: "inherit",
          fontWeight: 700,
          background: stockFilter === id ? color : `${color}18`,
          color: stockFilter === id ? "#fff" : color,
          border: `1px solid ${color}`,
          borderRadius: T.radius,
          cursor: "pointer",
          whiteSpace: "nowrap",
          ...(m3Pair && {
            padding: "0 12px",
            height: 32,
            fontSize: 12,
            fontWeight: 600,
            background: stockFilter === id ? m3Pair.fg : m3Pair.bg,
            color: stockFilter === id ? m3Pair.bg : m3Pair.fg,
            border: "none",
            borderRadius: 12,
          }),
        }}
      >
        {count} {label}
      </button>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <SectionHd
        title="Inventory"
        badge={`${rows.length} items`}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              className="bp-no-scrollbar"
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                touchAction: "pan-x pan-y",
              }}
            >
              {stockPill("out", "Out of Stock", outCount, T.bad)}
              {stockPill("low", "Low Stock", lowCount, T.warn)}
              {stockPill("normal", "Normal", normalCount, T.ok)}
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              style={{
                fontFamily: "inherit",
                fontSize: 12,
                background: T.surface,
                border: `1px solid ${catFilter !== "all" ? T.accent : T.line2}`,
                color: catFilter !== "all" ? T.accent : T.text,
                borderRadius: T.radius,
                padding: "6px 8px",
                outline: "none",
                cursor: "pointer",
                ...(m3 && {
                  background: m3.containerHigh,
                  border:
                    catFilter !== "all" ? `1px solid ${T.accent}` : "none",
                  borderRadius: 12,
                  minHeight: 40,
                  padding: "0 12px",
                }),
              }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search inventory…"
            />
          </div>
        }
      />
      {loading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: T.textMute,
            fontFamily: T.mono,
            fontSize: 12,
          }}
        >
          Loading…
        </div>
      ) : (
        <div
          className="bp-no-scrollbar"
          style={{
            flex: 1,
            overflow: "auto",
            touchAction: "pan-x pan-y",
            overscrollBehaviorX: "contain",
            overscrollBehaviorY: "none",
            ...(m3 && {
              margin: "0 20px 20px",
              background: m3.container,
              borderRadius: 24,
              boxShadow: m3.elev1,
            }),
          }}
        >
          <div style={{ minWidth: 680, ...(m3 && { padding: "0 8px 8px" }) }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 80px 80px 120px 160px",
                padding: m3 ? "0 12px" : "0 24px",
                height: m3 ? 44 : 36,
                alignItems: "center",
                borderBottom: m3 ? "none" : `1px solid ${T.line}`,
                background: m3 ? m3.container : T.surface2,
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              {(
                [
                  ["Item", "name"],
                  ["Category", "category"],
                  ["Qty", "quantity"],
                  ["Unit", "unit"],
                  ["Threshold", "lowStockThresh"],
                  ["Adjust", null],
                ] as [string, keyof InvRow | null][]
              ).map(([h, k]) =>
                k ? (
                  <button
                    key={h}
                    onClick={() => sortToggle(k)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: m3 ? 11 : 10,
                      fontWeight: 600,
                      letterSpacing: m3 ? "0.04em" : "0.12em",
                      textTransform: "uppercase",
                      color: m3 ? T.textMute : T.headerText,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      textAlign: "left",
                    }}
                  >
                    {h}
                    <span style={{ fontSize: 8, opacity: 0.7 }}>
                      {sortIcon(k)}
                    </span>
                  </button>
                ) : (
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
                ),
              )}
            </div>
            {sortedRows.map((row, i) => {
              const isLow = row.quantity <= row.lowStockThresh;
              const isCritical = row.quantity === 0;
              const isAuto =
                row.category === "Beer" || row.category === "Cigarettes";
              return (
                <div
                  key={row.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 80px 80px 120px 160px",
                    padding: m3 ? "0 12px" : "0 24px",
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
                    opacity: saving === row.id ? 0.5 : 1,
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 500, color: T.text }}
                  >
                    {row.name}
                  </span>
                  <span style={{ fontSize: 11, color: T.textMute }}>
                    {row.category}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 14,
                      fontWeight: 700,
                      color: isCritical ? T.bad : isLow ? T.warn : T.ok,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.quantity}
                  </span>
                  <span style={{ fontSize: 12, color: T.textMute }}>
                    {row.unit}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 12,
                      color: T.textMute,
                    }}
                  >
                    {row.lowStockThresh}
                    {isLow && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          color: isCritical ? T.bad : T.warn,
                          ...(m3 && {
                            fontFamily: T.sansBody,
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: isCritical
                              ? m3.badContainer
                              : m3.warnContainer,
                            color: isCritical
                              ? m3.onBadContainer
                              : m3.onWarnContainer,
                          }),
                        }}
                      >
                        {isCritical ? "OUT" : "LOW"}
                      </span>
                    )}
                  </span>
                  <div
                    title={
                      isAuto
                        ? "This stock is auto-managed by sales and expense restocks"
                        : undefined
                    }
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <button
                      onClick={() => adjust(row, -1)}
                      disabled={saving === row.id || isAuto}
                      style={{
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: m3 ? m3.containerHighest : T.chip,
                        border: m3 ? "none" : `1px solid ${T.line2}`,
                        color: m3 ? T.text : T.textDim,
                        borderRadius: m3 ? 18 : T.radius,
                        cursor: isAuto ? "not-allowed" : "pointer",
                        fontSize: 16,
                        fontFamily: "inherit",
                        opacity: isAuto ? 0.35 : 1,
                      }}
                    >
                      −
                    </button>
                    <button
                      onClick={() => adjust(row, 1)}
                      disabled={saving === row.id || isAuto}
                      style={{
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: m3 ? m3.containerHighest : T.chip,
                        border: m3 ? "none" : `1px solid ${T.line2}`,
                        color: m3 ? T.text : T.textDim,
                        borderRadius: m3 ? 18 : T.radius,
                        cursor: isAuto ? "not-allowed" : "pointer",
                        fontSize: 16,
                        fontFamily: "inherit",
                        opacity: isAuto ? 0.35 : 1,
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => adjust(row, 10)}
                      disabled={saving === row.id || isAuto}
                      style={{
                        padding: "8px 10px",
                        fontSize: 11,
                        fontFamily: "inherit",
                        background: m3 ? m3.containerHighest : T.chip,
                        border: m3 ? "none" : `1px solid ${T.line2}`,
                        color: m3 ? T.text : T.textDim,
                        borderRadius: m3 ? 18 : T.radius,
                        cursor: isAuto ? "not-allowed" : "pointer",
                        opacity: isAuto ? 0.35 : 1,
                      }}
                    >
                      +10
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
