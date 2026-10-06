"use client";

import { useTheme } from "@/lib/ThemeContext";
import { useState, useCallback, useEffect, useMemo } from "react";
import { getClient } from "@/lib/supabase";
import { SectionHd, Pill, SearchBox, fmtPeso } from "./ownerShared";
import { useSortable } from "@/lib/useSortable";
import { MENU_GROUPS, type MenuGroupId } from "@/lib/menuGroups";

interface IngredientRow {
  id: number;
  name: string;
  unit: string;
  pricePerUnit: number;
  lossPct: number;
}

interface RecipeLineRow {
  id: number;
  menuItemId: string;
  ingredientId: number;
  qtyPerUnit: number;
}

interface MenuRow {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number | null; // what the POS charges to COGS; shown as "Recipe Cost"
  manualCost: number | null; // permanent snapshot of the original hand-entered cost — never touched by Confirm/Revert
  costMode: "manual" | "recipe";
}

interface RecipeItemView extends MenuRow {
  lines: RecipeLineRow[];
  recipeCost: number | null; // null when the item has zero recipe lines
  status: "none" | "in_progress" | "confirmed";
}

// line cost accounts for expected cooking/cleaning loss: you must buy more
// raw ingredient than the recipe weight to end up with that weight on the plate.
// Rounded up to the nearest peso so recipe costs are always whole numbers.
function lineCost(line: RecipeLineRow, ing: IngredientRow | undefined): number {
  if (!ing) return 0;
  return Math.ceil((line.qtyPerUnit * ing.pricePerUnit) / (1 - ing.lossPct));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = getClient() as any;

export default function RecipeTab() {
  const { T } = useTheme();
  const m3 = T.m3;

  const [items, setItems] = useState<MenuRow[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [lines, setLines] = useState<RecipeLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<MenuGroupId>("food");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // ── Add-ingredient form state (scoped to whichever row is expanded) ──────
  const [addMode, setAddMode] = useState<"closed" | "pick" | "new">("closed");
  const [pickId, setPickId] = useState<string>("");
  const [qtyInput, setQtyInput] = useState("");
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("kg");
  const [newPrice, setNewPrice] = useState("");
  const [newLoss, setNewLoss] = useState("");

  // ── Inline ingredient-field edit state (price/loss/qty on an existing line) ─
  const [editField, setEditField] = useState<{
    lineId: number;
    field: "qty" | "price" | "loss";
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchAll = useCallback(async () => {
    const [{ data: mi }, { data: ing }, { data: rl }] = await Promise.all([
      sb
        .from("menu_items")
        .select("id, name, category, price, cost, manual_cost, cost_mode")
        .order("sort_order"),
      sb
        .from("ingredients")
        .select("id, name, unit, price_per_unit, loss_pct")
        .order("name"),
      sb
        .from("recipe_lines")
        .select("id, menu_item_id, ingredient_id, qty_per_unit"),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setItems(
      (mi ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        price: r.price,
        cost: r.cost,
        manualCost: r.manual_cost,
        costMode: r.cost_mode,
      })),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setIngredients(
      (ing ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        unit: r.unit,
        pricePerUnit: r.price_per_unit,
        lossPct: r.loss_pct,
      })),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLines(
      (rl ?? []).map((r: any) => ({
        id: r.id,
        menuItemId: r.menu_item_id,
        ingredientId: r.ingredient_id,
        qtyPerUnit: r.qty_per_unit,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );

  const view: RecipeItemView[] = useMemo(
    () =>
      items.map((item) => {
        const itemLines = lines.filter((l) => l.menuItemId === item.id);
        const recipeCost =
          itemLines.length === 0
            ? null
            : itemLines.reduce(
                (s, l) => s + lineCost(l, ingredientById.get(l.ingredientId)),
                0,
              );
        const status: RecipeItemView["status"] =
          item.costMode === "recipe"
            ? "confirmed"
            : itemLines.length > 0
              ? "in_progress"
              : "none";
        return { ...item, lines: itemLines, recipeCost, status };
      }),
    [items, lines, ingredientById],
  );

  const activeGroup = MENU_GROUPS.find((g) => g.id === group)!;
  // Sub-categories present in the loaded items for the active group
  const subCats = activeGroup.cats.filter((c) =>
    items.some((i) => i.category === c),
  );
  const groupList = activeCat
    ? view.filter((i) => i.category === activeCat)
    : view.filter((i) =>
        (activeGroup.cats as readonly string[]).includes(i.category),
      );
  const baseList = search.trim()
    ? groupList.filter((i) =>
        i.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : groupList;
  const {
    sorted: filtered,
    toggle: sortToggle,
    icon: sortIcon,
  } = useSortable(baseList, "name" as keyof RecipeItemView);

  const confirmedCount = view.filter((v) => v.status === "confirmed").length;

  function selectGroup(g: MenuGroupId) {
    setGroup(g);
    setActiveCat(null);
  }

  function resetAddForm() {
    setAddMode("closed");
    setPickId("");
    setQtyInput("");
    setNewName("");
    setNewUnit("kg");
    setNewPrice("");
    setNewLoss("");
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    resetAddForm();
    setEditField(null);
  }

  async function addExistingLine(menuItemId: string) {
    const ingredientId = parseInt(pickId, 10);
    const qty = parseFloat(qtyInput);
    if (!ingredientId || isNaN(qty) || qty <= 0) return;
    setBusy(menuItemId);
    await sb.from("recipe_lines").insert({
      menu_item_id: menuItemId,
      ingredient_id: ingredientId,
      qty_per_unit: qty,
    });
    await fetchAll();
    resetAddForm();
    setBusy(null);
  }

  async function addNewIngredientLine(menuItemId: string) {
    const price = parseFloat(newPrice);
    const lossPct = (parseFloat(newLoss) || 0) / 100;
    const qty = parseFloat(qtyInput);
    if (!newName.trim() || isNaN(price) || price < 0 || isNaN(qty) || qty <= 0)
      return;
    setBusy(menuItemId);
    const { data: newIng, error } = await sb
      .from("ingredients")
      .insert({
        name: newName.trim(),
        unit: newUnit.trim() || "kg",
        price_per_unit: price,
        loss_pct: lossPct,
      })
      .select("id")
      .single();
    if (!error && newIng) {
      await sb.from("recipe_lines").insert({
        menu_item_id: menuItemId,
        ingredient_id: newIng.id,
        qty_per_unit: qty,
      });
    }
    await fetchAll();
    resetAddForm();
    setBusy(null);
  }

  async function removeLine(lineId: number, menuItemId: string) {
    setBusy(menuItemId);
    await sb.from("recipe_lines").delete().eq("id", lineId);
    await fetchAll();
    setBusy(null);
  }

  async function saveLineQty(line: RecipeLineRow) {
    const qty = parseFloat(editValue);
    setEditField(null);
    if (isNaN(qty) || qty <= 0) return;
    setBusy(line.menuItemId);
    await sb
      .from("recipe_lines")
      .update({ qty_per_unit: qty })
      .eq("id", line.id);
    await fetchAll();
    setBusy(null);
  }

  async function saveIngredientField(
    ing: IngredientRow,
    field: "price" | "loss",
    menuItemId: string,
  ) {
    const raw = parseFloat(editValue);
    setEditField(null);
    if (isNaN(raw)) return;
    setBusy(menuItemId);
    if (field === "price") {
      await sb
        .from("ingredients")
        .update({ price_per_unit: raw })
        .eq("id", ing.id);
    } else {
      await sb
        .from("ingredients")
        .update({ loss_pct: raw / 100 })
        .eq("id", ing.id);
    }
    await fetchAll();
    setBusy(null);
  }

  async function confirmRecipe(item: RecipeItemView) {
    if (item.recipeCost == null) return;
    setBusy(item.id);
    await sb
      .from("menu_items")
      .update({ cost: item.recipeCost, cost_mode: "recipe" })
      .eq("id", item.id);
    await fetchAll();
    setBusy(null);
  }

  async function revertToManual(item: RecipeItemView) {
    setBusy(item.id);
    await sb
      .from("menu_items")
      .update({ cost: item.manualCost, cost_mode: "manual" })
      .eq("id", item.id);
    await fetchAll();
    setBusy(null);
  }

  // How many OTHER dishes share a given ingredient — shown so editing price/loss
  // makes clear it's a global change, not scoped to the dish you're looking at.
  function usageCount(ingredientId: number): number {
    return new Set(
      lines
        .filter((l) => l.ingredientId === ingredientId)
        .map((l) => l.menuItemId),
    ).size;
  }

  const statusBadge = (status: RecipeItemView["status"]) => {
    const map = {
      none: {
        label: "No Recipe",
        color: T.textMute,
        bg: T.chip,
        border: T.line2,
      },
      in_progress: {
        label: "In Progress",
        color: T.warn,
        bg: `${T.warn}18`,
        border: `${T.warn}44`,
      },
      confirmed: {
        label: "Confirmed",
        color: T.ok,
        bg: `${T.ok}18`,
        border: `${T.ok}44`,
      },
    } as const;
    const s = map[status];
    const m3Pair = m3
      ? status === "confirmed"
        ? { bg: m3.okContainer, fg: m3.onOkContainer }
        : status === "in_progress"
          ? { bg: m3.warnContainer, fg: m3.onWarnContainer }
          : { bg: m3.containerHighest, fg: T.textDim }
      : null;
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: s.color,
          background: s.bg,
          border: `1px solid ${s.border}`,
          padding: "2px 8px",
          borderRadius: T.radius,
          whiteSpace: "nowrap",
          ...(m3Pair && {
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: m3Pair.fg,
            background: m3Pair.bg,
            border: "none",
            padding: "4px 10px",
            borderRadius: 10,
          }),
        }}
      >
        {s.label}
      </span>
    );
  };

  const editInputStyle = {
    width: 70,
    fontFamily: T.mono,
    fontSize: 12,
    fontWeight: 600,
    background: T.surface,
    border: `1px solid ${T.accent}88`,
    color: T.text,
    borderRadius: T.radius,
    padding: "2px 6px",
    outline: "none",
    ...(m3 && {
      background: m3.containerHighest,
      borderRadius: 10,
      padding: "6px 8px",
    }),
  } as const;

  // ── M3 building blocks (empty under the classic themes) ───────────────────
  const m3Label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: T.textDim,
    marginBottom: 6,
  };
  const m3Input: React.CSSProperties = m3
    ? {
        fontSize: 13,
        background: m3.containerHigh,
        border: "none",
        borderRadius: 12,
        minHeight: 40,
        padding: "0 12px",
        boxSizing: "border-box",
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
  const m3Secondary: React.CSSProperties = m3
    ? {
        background: m3.containerHighest,
        color: T.text,
        border: "none",
        borderRadius: 20,
        minHeight: 40,
        padding: "0 16px",
        fontSize: 13,
        fontWeight: 500,
      }
    : {};
  const m3Track: React.CSSProperties = m3
    ? { gap: 4, padding: 3, background: m3.track, borderRadius: 18 }
    : {};
  const segBtn = (
    key: string,
    label: string,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      key={key}
      onClick={onClick}
      style={{
        padding: "0 16px",
        height: 34,
        fontSize: 13,
        fontFamily: "inherit",
        fontWeight: active ? 600 : 500,
        flexShrink: 0,
        background: active ? T.accent : "transparent",
        color: active ? T.accentInk : T.textDim,
        border: "none",
        borderRadius: 16,
        cursor: "pointer",
        transition: "background 0.12s ease",
      }}
    >
      {label}
    </button>
  );

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
        title="Recipe Costing"
        badge={`${confirmedCount}/${items.length} confirmed`}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              className="bp-no-scrollbar"
              style={{
                display: "flex",
                gap: 4,
                overflowX: "auto",
                touchAction: "pan-x pan-y",
                ...m3Track,
              }}
            >
              {MENU_GROUPS.map((g) =>
                m3 ? (
                  segBtn(g.id, g.label, group === g.id, () => selectGroup(g.id))
                ) : (
                  <Pill
                    key={g.id}
                    label={g.label}
                    active={group === g.id}
                    onClick={() => selectGroup(g.id)}
                  />
                ),
              )}
            </div>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search recipes…"
            />
          </div>
        }
      />

      {/* Sub-category chips — same Food/Drinks/Add-Ons/Others grouping as On-Going */}
      {subCats.length > 1 && (
        <div
          className="bp-no-scrollbar"
          style={{
            display: "flex",
            gap: m3 ? 8 : 6,
            padding: m3 ? "0 20px 14px" : "10px 24px",
            borderBottom: m3 ? "none" : `1px solid ${T.line}`,
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <Pill
            label="All"
            active={activeCat === null}
            onClick={() => setActiveCat(null)}
          />
          {subCats.map((c) => (
            <Pill
              key={c}
              label={c}
              active={activeCat === c}
              onClick={() => setActiveCat(c)}
            />
          ))}
        </div>
      )}

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
          <div style={{ minWidth: 960, ...(m3 && { padding: "0 8px 8px" }) }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 90px 90px 100px 110px 90px 80px 100px 100px 110px 24px",
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
                  ["Price", "price"],
                  ["Flat Cost", "manualCost"],
                  ["Recipe Cost", "cost"],
                  ["Diff ₱", null],
                  ["Diff %", null],
                  ["Margin % Flat", null],
                  ["Margin % Recipe", null],
                  ["Status", "status"],
                  ["", null],
                ] as [string, keyof RecipeItemView | null][]
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
            {filtered.map((item, i) => {
              const isOpen = expandedId === item.id;
              const isBusy = busy === item.id;
              const diff =
                item.cost != null && item.manualCost != null
                  ? item.cost - item.manualCost
                  : null;
              const diffPct =
                diff != null && item.manualCost
                  ? (diff / item.manualCost) * 100
                  : null;
              const marginFlat =
                item.manualCost != null && item.price
                  ? ((item.price - item.manualCost) / item.price) * 100
                  : null;
              const marginRecipe =
                item.cost != null && item.price
                  ? ((item.price - item.cost) / item.price) * 100
                  : null;
              return (
                <div
                  key={item.id}
                  style={
                    m3
                      ? {
                          borderRadius: isOpen ? 16 : 14,
                          overflow: "hidden",
                          background: isOpen
                            ? m3.containerHigh
                            : i % 2 === 0
                              ? m3.containerHigh
                              : "transparent",
                          margin: isOpen ? "4px 0" : undefined,
                        }
                      : { borderBottom: `1px solid ${T.line}` }
                  }
                >
                  <div
                    onClick={() => toggleExpand(item.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1fr 90px 90px 100px 110px 90px 80px 100px 100px 110px 24px",
                      padding: m3 ? "0 12px" : "0 24px",
                      height: m3 ? 48 : 44,
                      alignItems: "center",
                      cursor: "pointer",
                      background: m3
                        ? "transparent"
                        : isOpen
                          ? T.surface2
                          : i % 2 === 0
                            ? "transparent"
                            : T.surface,
                      opacity: isBusy ? 0.5 : 1,
                    }}
                  >
                    <span
                      style={{ fontSize: 13, fontWeight: 500, color: T.text }}
                    >
                      {item.name}
                    </span>
                    <span style={{ fontSize: 11, color: T.textMute }}>
                      {item.category}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 12,
                        color: T.textDim,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtPeso(item.price)}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 12,
                        color: T.text,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.manualCost != null ? fmtPeso(item.manualCost) : "—"}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 12,
                        color: T.text,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.cost != null ? fmtPeso(item.cost) : "—"}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 12,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color:
                          diff == null
                            ? T.textMute
                            : diff > 0
                              ? T.bad
                              : diff < 0
                                ? T.ok
                                : T.textMute,
                      }}
                    >
                      {diff == null
                        ? "—"
                        : `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 12,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color:
                          diffPct == null
                            ? T.textMute
                            : diffPct > 0
                              ? T.bad
                              : diffPct < 0
                                ? T.ok
                                : T.textMute,
                      }}
                    >
                      {diffPct == null
                        ? "—"
                        : `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 12,
                        color: T.textDim,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {marginFlat == null ? "—" : `${marginFlat.toFixed(1)}%`}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 12,
                        color: T.textDim,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {marginRecipe == null
                        ? "—"
                        : `${marginRecipe.toFixed(1)}%`}
                    </span>
                    <span>{statusBadge(item.status)}</span>
                    <span
                      style={{
                        color: T.textMute,
                        fontSize: 12,
                        textAlign: "right",
                      }}
                    >
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </div>

                  {isOpen && (
                    <div
                      style={
                        m3
                          ? { background: "transparent" }
                          : {
                              background: T.surface2,
                              borderTop: `1px solid ${T.line}`,
                            }
                      }
                    >
                      <div
                        className="bp-no-scrollbar"
                        style={{
                          overflowX: "auto",
                          touchAction: "pan-x pan-y",
                        }}
                      >
                        <div
                          style={{
                            minWidth: 700,
                            padding: m3 ? "4px 12px 16px" : "14px 24px 18px",
                          }}
                        >
                          {item.lines.length === 0 ? (
                            <div
                              style={{
                                fontSize: 12,
                                color: T.textMute,
                                marginBottom: 12,
                              }}
                            >
                              No ingredients added yet.
                            </div>
                          ) : (
                            <div style={{ marginBottom: 14 }}>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "1fr 90px 90px 90px 100px 24px",
                                  gap: 0,
                                  marginBottom: 6,
                                }}
                              >
                                {[
                                  "Ingredient",
                                  "Qty",
                                  "Price/Unit",
                                  "Loss %",
                                  "Line Cost",
                                  "",
                                ].map((h) => (
                                  <span
                                    key={h}
                                    style={{
                                      fontSize: m3 ? 11 : 9,
                                      fontWeight: m3 ? 600 : 700,
                                      letterSpacing: m3 ? "0.04em" : "0.1em",
                                      textTransform: "uppercase",
                                      color: m3 ? T.textMute : T.headerText,
                                    }}
                                  >
                                    {h}
                                  </span>
                                ))}
                              </div>
                              {item.lines.map((line) => {
                                const ing = ingredientById.get(
                                  line.ingredientId,
                                );
                                if (!ing) return null;
                                const cost = lineCost(line, ing);
                                const editingQty =
                                  editField?.lineId === line.id &&
                                  editField.field === "qty";
                                const editingPrice =
                                  editField?.lineId === line.id &&
                                  editField.field === "price";
                                const editingLoss =
                                  editField?.lineId === line.id &&
                                  editField.field === "loss";
                                const usedElsewhere = usageCount(ing.id) > 1;
                                return (
                                  <div
                                    key={line.id}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "1fr 90px 90px 90px 100px 24px",
                                      alignItems: "center",
                                      minHeight: 30,
                                    }}
                                  >
                                    <span
                                      style={{ fontSize: 12, color: T.text }}
                                    >
                                      {ing.name}
                                      {usedElsewhere && (
                                        <span
                                          title={`Shared with ${usageCount(ing.id) - 1} other dish(es) — editing price/loss changes it everywhere`}
                                          style={{
                                            marginLeft: 6,
                                            fontSize: 9,
                                            color: T.textMute,
                                            fontFamily: T.mono,
                                          }}
                                        >
                                          ×{usageCount(ing.id)}
                                        </span>
                                      )}
                                    </span>

                                    {editingQty ? (
                                      <input
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        onBlur={() => saveLineQty(line)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            saveLineQty(line);
                                          if (e.key === "Escape")
                                            setEditField(null);
                                        }}
                                        style={editInputStyle}
                                      />
                                    ) : (
                                      <span
                                        onClick={() => {
                                          setEditField({
                                            lineId: line.id,
                                            field: "qty",
                                          });
                                          setEditValue(String(line.qtyPerUnit));
                                        }}
                                        title="Click to edit recipe weight"
                                        style={{
                                          fontFamily: T.mono,
                                          fontSize: 12,
                                          color: T.text,
                                          cursor: "pointer",
                                          borderBottom: `1px dashed ${T.line2}`,
                                        }}
                                      >
                                        {line.qtyPerUnit}
                                        {ing.unit}
                                      </span>
                                    )}

                                    {editingPrice ? (
                                      <input
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        onBlur={() =>
                                          saveIngredientField(
                                            ing,
                                            "price",
                                            item.id,
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            saveIngredientField(
                                              ing,
                                              "price",
                                              item.id,
                                            );
                                          if (e.key === "Escape")
                                            setEditField(null);
                                        }}
                                        style={editInputStyle}
                                      />
                                    ) : (
                                      <span
                                        onClick={() => {
                                          setEditField({
                                            lineId: line.id,
                                            field: "price",
                                          });
                                          setEditValue(
                                            String(ing.pricePerUnit),
                                          );
                                        }}
                                        title="Click to edit ingredient price (applies everywhere this ingredient is used)"
                                        style={{
                                          fontFamily: T.mono,
                                          fontSize: 12,
                                          color: T.accent,
                                          cursor: "pointer",
                                          borderBottom: `1px dashed ${T.accent}44`,
                                        }}
                                      >
                                        ₱{ing.pricePerUnit.toFixed(2)}
                                      </span>
                                    )}

                                    {editingLoss ? (
                                      <input
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        onBlur={() =>
                                          saveIngredientField(
                                            ing,
                                            "loss",
                                            item.id,
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            saveIngredientField(
                                              ing,
                                              "loss",
                                              item.id,
                                            );
                                          if (e.key === "Escape")
                                            setEditField(null);
                                        }}
                                        style={editInputStyle}
                                      />
                                    ) : (
                                      <span
                                        onClick={() => {
                                          setEditField({
                                            lineId: line.id,
                                            field: "loss",
                                          });
                                          setEditValue(
                                            String(
                                              (ing.lossPct * 100).toFixed(1),
                                            ),
                                          );
                                        }}
                                        title="Click to edit expected loss % (applies everywhere this ingredient is used)"
                                        style={{
                                          fontFamily: T.mono,
                                          fontSize: 12,
                                          color: T.accent,
                                          cursor: "pointer",
                                          borderBottom: `1px dashed ${T.accent}44`,
                                        }}
                                      >
                                        {(ing.lossPct * 100).toFixed(1)}%
                                      </span>
                                    )}

                                    <span
                                      style={{
                                        fontFamily: T.mono,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: T.text,
                                      }}
                                    >
                                      {fmtPeso(cost)}
                                    </span>

                                    <button
                                      onClick={() =>
                                        removeLine(line.id, item.id)
                                      }
                                      title="Remove ingredient"
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: T.bad,
                                        fontSize: 14,
                                        padding: 0,
                                        lineHeight: 1,
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* ── Add ingredient ────────────────────────────────────────── */}
                          {addMode === "closed" ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => setAddMode("pick")}
                                style={{
                                  padding: "5px 12px",
                                  fontSize: 11,
                                  fontFamily: "inherit",
                                  fontWeight: 600,
                                  background: T.chip,
                                  border: `1px solid ${T.line2}`,
                                  color: T.textDim,
                                  borderRadius: T.radius,
                                  cursor: "pointer",
                                  ...m3Secondary,
                                }}
                              >
                                + Add Ingredient
                              </button>
                            </div>
                          ) : (
                            <div
                              style={{
                                background: T.surface,
                                border: `1px solid ${T.line2}`,
                                borderRadius: T.radiusLg,
                                padding: 12,
                                marginBottom: 4,
                                ...(m3 && {
                                  background: m3.container,
                                  border: "none",
                                  borderRadius: 16,
                                  padding: 16,
                                }),
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  marginBottom: 10,
                                  ...(m3 && {
                                    ...m3Track,
                                    width: "fit-content",
                                    marginBottom: 14,
                                  }),
                                }}
                              >
                                {m3 ? (
                                  <>
                                    {segBtn(
                                      "pick",
                                      "Existing",
                                      addMode === "pick",
                                      () => setAddMode("pick"),
                                    )}
                                    {segBtn(
                                      "new",
                                      "New Ingredient",
                                      addMode === "new",
                                      () => setAddMode("new"),
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <Pill
                                      label="Existing"
                                      active={addMode === "pick"}
                                      onClick={() => setAddMode("pick")}
                                    />
                                    <Pill
                                      label="New Ingredient"
                                      active={addMode === "new"}
                                      onClick={() => setAddMode("new")}
                                    />
                                  </>
                                )}
                              </div>

                              {addMode === "pick" ? (
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 100px auto auto",
                                    gap: 8,
                                    alignItems: "end",
                                  }}
                                >
                                  <div>
                                    <div
                                      style={
                                        m3
                                          ? m3Label
                                          : {
                                              fontSize: 9,
                                              fontWeight: 600,
                                              letterSpacing: "0.08em",
                                              textTransform: "uppercase",
                                              color: T.textMute,
                                              marginBottom: 4,
                                            }
                                      }
                                    >
                                      Ingredient
                                    </div>
                                    <select
                                      value={pickId}
                                      onChange={(e) =>
                                        setPickId(e.target.value)
                                      }
                                      style={{
                                        width: "100%",
                                        fontFamily: "inherit",
                                        fontSize: 12,
                                        background: T.surface2,
                                        border: `1px solid ${T.line2}`,
                                        color: T.text,
                                        borderRadius: T.radius,
                                        padding: "6px 8px",
                                        outline: "none",
                                        ...m3Input,
                                      }}
                                    >
                                      <option value="">Select…</option>
                                      {ingredients.map((ing) => (
                                        <option key={ing.id} value={ing.id}>
                                          {ing.name} (₱{ing.pricePerUnit}/
                                          {ing.unit})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <div
                                      style={
                                        m3
                                          ? m3Label
                                          : {
                                              fontSize: 9,
                                              fontWeight: 600,
                                              letterSpacing: "0.08em",
                                              textTransform: "uppercase",
                                              color: T.textMute,
                                              marginBottom: 4,
                                            }
                                      }
                                    >
                                      Qty (kg)
                                    </div>
                                    <input
                                      value={qtyInput}
                                      onChange={(e) =>
                                        setQtyInput(e.target.value)
                                      }
                                      placeholder="0.300"
                                      type="number"
                                      min="0"
                                      step="0.001"
                                      style={{
                                        width: "100%",
                                        fontFamily: T.mono,
                                        fontSize: 12,
                                        background: T.surface2,
                                        border: `1px solid ${T.line2}`,
                                        color: T.text,
                                        borderRadius: T.radius,
                                        padding: "6px 8px",
                                        outline: "none",
                                        boxSizing: "border-box",
                                        ...m3Input,
                                      }}
                                    />
                                  </div>
                                  <button
                                    onClick={() => addExistingLine(item.id)}
                                    disabled={!pickId || !qtyInput}
                                    style={{
                                      padding: "6px 16px",
                                      fontSize: 12,
                                      fontFamily: "inherit",
                                      fontWeight: 700,
                                      background: T.accent,
                                      color: T.accentInk,
                                      border: "none",
                                      borderRadius: T.radius,
                                      cursor: "pointer",
                                      opacity: !pickId || !qtyInput ? 0.4 : 1,
                                      ...m3Primary,
                                    }}
                                  >
                                    Add
                                  </button>
                                  <button
                                    onClick={resetAddForm}
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: 12,
                                      fontFamily: "inherit",
                                      background: "none",
                                      border: `1px solid ${T.line2}`,
                                      color: T.textDim,
                                      borderRadius: T.radius,
                                      cursor: "pointer",
                                      ...m3Secondary,
                                      ...(m3 && {
                                        background: m3.containerHigh,
                                      }),
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "1fr 70px 90px 80px 90px auto auto",
                                    gap: 8,
                                    alignItems: "end",
                                  }}
                                >
                                  <div>
                                    <div
                                      style={
                                        m3
                                          ? m3Label
                                          : {
                                              fontSize: 9,
                                              fontWeight: 600,
                                              letterSpacing: "0.08em",
                                              textTransform: "uppercase",
                                              color: T.textMute,
                                              marginBottom: 4,
                                            }
                                      }
                                    >
                                      Name
                                    </div>
                                    <input
                                      value={newName}
                                      onChange={(e) =>
                                        setNewName(e.target.value)
                                      }
                                      placeholder="e.g. Chicken Breast"
                                      style={{
                                        width: "100%",
                                        fontFamily: "inherit",
                                        fontSize: 12,
                                        background: T.surface2,
                                        border: `1px solid ${T.line2}`,
                                        color: T.text,
                                        borderRadius: T.radius,
                                        padding: "6px 8px",
                                        outline: "none",
                                        boxSizing: "border-box",
                                        ...m3Input,
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <div
                                      style={
                                        m3
                                          ? m3Label
                                          : {
                                              fontSize: 9,
                                              fontWeight: 600,
                                              letterSpacing: "0.08em",
                                              textTransform: "uppercase",
                                              color: T.textMute,
                                              marginBottom: 4,
                                            }
                                      }
                                    >
                                      Unit
                                    </div>
                                    <input
                                      value={newUnit}
                                      onChange={(e) =>
                                        setNewUnit(e.target.value)
                                      }
                                      placeholder="kg"
                                      style={{
                                        width: "100%",
                                        fontFamily: T.mono,
                                        fontSize: 12,
                                        background: T.surface2,
                                        border: `1px solid ${T.line2}`,
                                        color: T.text,
                                        borderRadius: T.radius,
                                        padding: "6px 8px",
                                        outline: "none",
                                        boxSizing: "border-box",
                                        ...m3Input,
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <div
                                      style={
                                        m3
                                          ? m3Label
                                          : {
                                              fontSize: 9,
                                              fontWeight: 600,
                                              letterSpacing: "0.08em",
                                              textTransform: "uppercase",
                                              color: T.textMute,
                                              marginBottom: 4,
                                            }
                                      }
                                    >
                                      Price/Unit
                                    </div>
                                    <input
                                      value={newPrice}
                                      onChange={(e) =>
                                        setNewPrice(e.target.value)
                                      }
                                      placeholder="210.00"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      style={{
                                        width: "100%",
                                        fontFamily: T.mono,
                                        fontSize: 12,
                                        background: T.surface2,
                                        border: `1px solid ${T.line2}`,
                                        color: T.text,
                                        borderRadius: T.radius,
                                        padding: "6px 8px",
                                        outline: "none",
                                        boxSizing: "border-box",
                                        ...m3Input,
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <div
                                      style={
                                        m3
                                          ? m3Label
                                          : {
                                              fontSize: 9,
                                              fontWeight: 600,
                                              letterSpacing: "0.08em",
                                              textTransform: "uppercase",
                                              color: T.textMute,
                                              marginBottom: 4,
                                            }
                                      }
                                    >
                                      Loss %
                                    </div>
                                    <input
                                      value={newLoss}
                                      onChange={(e) =>
                                        setNewLoss(e.target.value)
                                      }
                                      placeholder="20"
                                      type="number"
                                      min="0"
                                      max="99"
                                      step="0.1"
                                      style={{
                                        width: "100%",
                                        fontFamily: T.mono,
                                        fontSize: 12,
                                        background: T.surface2,
                                        border: `1px solid ${T.line2}`,
                                        color: T.text,
                                        borderRadius: T.radius,
                                        padding: "6px 8px",
                                        outline: "none",
                                        boxSizing: "border-box",
                                        ...m3Input,
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <div
                                      style={
                                        m3
                                          ? m3Label
                                          : {
                                              fontSize: 9,
                                              fontWeight: 600,
                                              letterSpacing: "0.08em",
                                              textTransform: "uppercase",
                                              color: T.textMute,
                                              marginBottom: 4,
                                            }
                                      }
                                    >
                                      Qty (kg)
                                    </div>
                                    <input
                                      value={qtyInput}
                                      onChange={(e) =>
                                        setQtyInput(e.target.value)
                                      }
                                      placeholder="0.300"
                                      type="number"
                                      min="0"
                                      step="0.001"
                                      style={{
                                        width: "100%",
                                        fontFamily: T.mono,
                                        fontSize: 12,
                                        background: T.surface2,
                                        border: `1px solid ${T.line2}`,
                                        color: T.text,
                                        borderRadius: T.radius,
                                        padding: "6px 8px",
                                        outline: "none",
                                        boxSizing: "border-box",
                                        ...m3Input,
                                      }}
                                    />
                                  </div>
                                  <button
                                    onClick={() =>
                                      addNewIngredientLine(item.id)
                                    }
                                    disabled={
                                      !newName || !newPrice || !qtyInput
                                    }
                                    style={{
                                      padding: "6px 16px",
                                      fontSize: 12,
                                      fontFamily: "inherit",
                                      fontWeight: 700,
                                      background: T.accent,
                                      color: T.accentInk,
                                      border: "none",
                                      borderRadius: T.radius,
                                      cursor: "pointer",
                                      opacity:
                                        !newName || !newPrice || !qtyInput
                                          ? 0.4
                                          : 1,
                                      ...m3Primary,
                                    }}
                                  >
                                    Add
                                  </button>
                                  <button
                                    onClick={resetAddForm}
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: 12,
                                      fontFamily: "inherit",
                                      background: "none",
                                      border: `1px solid ${T.line2}`,
                                      color: T.textDim,
                                      borderRadius: T.radius,
                                      cursor: "pointer",
                                      ...m3Secondary,
                                      ...(m3 && {
                                        background: m3.containerHigh,
                                      }),
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Confirm / revert ──────────────────────────────────────── */}
                          {item.lines.length > 0 && (
                            <div
                              style={{
                                marginTop: 14,
                                paddingTop: m3 ? 4 : 12,
                                borderTop: m3 ? "none" : `1px solid ${T.line}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: m3 ? 12 : 11,
                                  color: m3 ? T.textDim : T.textMute,
                                }}
                              >
                                Ingredient cost:{" "}
                                <strong style={{ color: T.text }}>
                                  {fmtPeso(item.recipeCost ?? 0)}
                                </strong>
                                {item.status === "confirmed" && (
                                  <span style={{ marginLeft: 8, color: T.ok }}>
                                    — currently used for costing
                                  </span>
                                )}
                              </span>
                              {item.status === "confirmed" ? (
                                <button
                                  onClick={() => revertToManual(item)}
                                  style={{
                                    padding: "6px 14px",
                                    fontSize: 12,
                                    fontFamily: "inherit",
                                    fontWeight: 600,
                                    background: T.chip,
                                    border: `1px solid ${T.line2}`,
                                    color: T.textDim,
                                    borderRadius: T.radius,
                                    cursor: "pointer",
                                    ...m3Secondary,
                                  }}
                                >
                                  Revert to Manual Cost
                                </button>
                              ) : (
                                <button
                                  onClick={() => confirmRecipe(item)}
                                  style={{
                                    padding: "6px 14px",
                                    fontSize: 12,
                                    fontFamily: "inherit",
                                    fontWeight: 700,
                                    background: T.ok,
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: T.radius,
                                    cursor: "pointer",
                                    ...(m3 && {
                                      background: m3.okContainer,
                                      color: m3.onOkContainer,
                                      borderRadius: 20,
                                      minHeight: 40,
                                      padding: "0 18px",
                                      fontSize: 13,
                                      fontWeight: 600,
                                    }),
                                  }}
                                >
                                  Confirm & Use Ingredient Cost
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
