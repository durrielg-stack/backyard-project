"use client";

import { useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import type { CartLine } from "@/lib/types";

const VOID_REASONS = [
  "Wrong item",
  "Changed mind",
  "Unavailable",
  "Duplicate",
] as const;

interface OrderLineProps {
  line: CartLine;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onUpdateQty: (lineId: string, delta: number) => void;
  onVoid: (lineId: string, reason: string) => void;
  onSetNote: (lineId: string, note: string) => void;
  onBill: (lineId: string) => void;
  onSetOrderType: (lineId: string, type: "dine_in" | "takeout") => void;
  bulkMode?: boolean;
  bulkChecked?: boolean;
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4M7 7v4M9 7v4" />
    </svg>
  );
}
function NoteIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <path d="M3 3h7l3 3v7H3z M10 3v3h3" />
    </svg>
  );
}

export default function OrderLine({
  line,
  index,
  selected,
  onSelect,
  onUpdateQty,
  onVoid,
  onSetNote,
  onBill,
  onSetOrderType,
  bulkMode = false,
  bulkChecked = false,
}: OrderLineProps) {
  const { T } = useTheme();
  const [editNote, setEditNote] = useState(false);
  const [noteVal, setNoteVal] = useState(line.note);
  const [confirmVoid, setConfirmVoid] = useState(false);

  const lineTotal = line.unitPrice * line.qty;
  const m3 = T.m3;
  // Square icon button under M3: tonal, borderless, 36px (classic stays 32px).
  const m3Icon: React.CSSProperties | undefined = m3
    ? {
        width: 36,
        height: 36,
        border: "none",
        borderRadius: 18,
        background: m3.containerHighest,
      }
    : undefined;

  return (
    <div
      onClick={() => onSelect()}
      className="bp-cart-in"
      style={{
        borderBottom: `1px solid ${T.line}`,
        borderLeft: bulkChecked
          ? `2px solid ${T.warn}`
          : selected
            ? `2px solid ${T.accent}`
            : "2px solid transparent",
        background: bulkChecked
          ? `${T.warn}0A`
          : selected
            ? T.surface2
            : "transparent",
        cursor: selected && !bulkMode ? "default" : "pointer",
        transition: "background 0.12s ease, border-color 0.12s ease",
        ...(m3 && {
          borderBottom: "none",
          borderLeft: "none",
          borderRadius: 14,
          flexShrink: 0,
          background: bulkChecked
            ? m3.warnTint
            : selected
              ? m3.containerHighest
              : m3.containerHigh,
          boxShadow: bulkChecked
            ? `inset 0 0 0 2px ${T.warn}`
            : selected
              ? `inset 0 0 0 2px ${T.accent}`
              : "none",
        }),
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: bulkMode
            ? "28px 28px 1fr auto"
            : "28px 1fr auto",
          padding:
            selected && !bulkMode
              ? "12px 16px 8px 14px"
              : "10px 16px 10px 14px",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        {/* Index */}
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 12,
            color: T.textMute,
            fontVariantNumeric: "tabular-nums",
            paddingTop: 2,
          }}
        >
          {String(index).padStart(2, "0")}
        </span>

        {/* Bulk checkbox */}
        {bulkMode && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            style={{
              width: 18,
              height: 18,
              marginTop: 2,
              border: `1.5px solid ${bulkChecked ? T.warn : T.line2}`,
              borderRadius: m3 ? 6 : 2,
              background: bulkChecked ? T.warn : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 0.12s ease, border-color 0.12s ease",
            }}
          >
            {bulkChecked && (
              <svg
                viewBox="0 0 10 10"
                width={10}
                height={10}
                fill="none"
                stroke="#fff"
                strokeWidth={1.5}
              >
                <path
                  d="M2 5l2.5 2.5L8 3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}

        {/* Name + note */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>
              {line.itemName}
            </span>
            {line.unitPrice > 0 && (
              <span
                style={{ fontSize: 12, color: T.textMute, fontFamily: T.mono }}
              >
                ₱{line.unitPrice.toFixed(0)}
              </span>
            )}
            {/* Dine-in / Takeout toggle pill */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetOrderType(
                  line.lineId,
                  line.orderType === "dine_in" ? "takeout" : "dine_in",
                );
              }}
              title={
                line.orderType === "takeout"
                  ? "Switch to Dine-In"
                  : "Switch to Takeout"
              }
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                border: `1px solid ${line.orderType === "takeout" ? T.info + "88" : T.line2}`,
                background:
                  line.orderType === "takeout" ? T.info + "20" : "transparent",
                color: line.orderType === "takeout" ? T.info : T.textMute,
                borderRadius: 4,
                cursor: "pointer",
                flexShrink: 0,
                transition: "all 0.12s ease",
                ...(m3 && {
                  border: "none",
                  borderRadius: 8,
                  letterSpacing: 0,
                  textTransform: "none",
                  fontWeight: 600,
                  minHeight: 32,
                  background:
                    line.orderType === "takeout"
                      ? m3.infoContainer
                      : m3.containerHighest,
                  color:
                    line.orderType === "takeout"
                      ? m3.onInfoContainer
                      : T.textDim,
                }),
              }}
            >
              {line.orderType === "takeout" ? "Takeout" : "Dine-In"}
            </button>
          </div>

          {/* Note pill */}
          {line.note && !editNote && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: T.warn,
                background: `${T.warn}18`,
                border: `1px solid ${T.warn}44`,
                padding: "2px 8px",
                borderRadius: T.radius,
                marginBottom: 4,
                ...(m3 && {
                  color: m3.onWarnContainer,
                  background: m3.warnContainer,
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                }),
              }}
            >
              <span>ⓘ</span>
              <span>{line.note}</span>
            </div>
          )}

          {/* Inline note editor */}
          {editNote && (
            <input
              autoFocus
              value={noteVal}
              onChange={(e) => setNoteVal(e.target.value)}
              onBlur={() => {
                onSetNote(line.lineId, noteVal);
                setEditNote(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSetNote(line.lineId, noteVal);
                  setEditNote(false);
                }
                if (e.key === "Escape") {
                  setNoteVal(line.note);
                  setEditNote(false);
                }
                e.stopPropagation();
              }}
              placeholder="Add a note…"
              style={{
                display: "block",
                width: "100%",
                marginBottom: 4,
                background: T.surface,
                border: `1px solid ${T.warn}88`,
                color: T.text,
                fontFamily: "inherit",
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: T.radius,
                outline: "none",
                ...(m3 && {
                  background: m3.containerHigh,
                  border: `1px solid ${T.warn}`,
                  minHeight: 40,
                  padding: "6px 12px",
                  fontSize: 13,
                  boxSizing: "border-box",
                }),
              }}
            />
          )}
        </div>

        {/* Right: line total + qty controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 14,
              fontWeight: 600,
              color: selected ? T.accent : T.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ₱{lineTotal.toFixed(2)}
          </span>

          {/* Qty stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (line.qty > 1) onUpdateQty(line.lineId, -1);
              }}
              disabled={line.qty <= 1}
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.chip,
                border: `1px solid ${T.line2}`,
                color: line.qty <= 1 ? T.textMute : T.textDim,
                fontFamily: "inherit",
                fontSize: 16,
                lineHeight: 1,
                borderRadius: T.radius,
                cursor: line.qty <= 1 ? "default" : "pointer",
                opacity: line.qty <= 1 ? 0.4 : 1,
                ...m3Icon,
              }}
            >
              −
            </button>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 14,
                fontWeight: 600,
                minWidth: 20,
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {line.qty}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateQty(line.lineId, 1);
              }}
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.chip,
                border: `1px solid ${T.line2}`,
                color: T.textDim,
                fontFamily: "inherit",
                fontSize: 16,
                lineHeight: 1,
                borderRadius: T.radius,
                cursor: "pointer",
                ...m3Icon,
              }}
            >
              +
            </button>
          </div>

          {/* Expanded: bill + note + void */}
          {selected && !confirmVoid && (
            <div style={{ display: "flex", gap: m3 ? 6 : 4 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBill(line.lineId);
                }}
                title="Bill this item"
                style={{
                  padding: "0 10px",
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontFamily: "inherit",
                  fontWeight: 600,
                  background: `${T.ok}18`,
                  border: `1px solid ${T.ok}44`,
                  color: T.ok,
                  borderRadius: T.radius,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  ...(m3 && {
                    height: 36,
                    padding: "0 16px",
                    fontSize: 13,
                    background: m3.okContainer,
                    color: m3.onOkContainer,
                    border: "none",
                    borderRadius: 18,
                    letterSpacing: 0,
                    textTransform: "none",
                  }),
                }}
              >
                Bill
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditNote(true);
                }}
                title="Add note"
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: T.chip,
                  border: `1px solid ${T.line2}`,
                  color: line.note ? T.warn : T.textDim,
                  borderRadius: T.radius,
                  cursor: "pointer",
                  ...m3Icon,
                }}
              >
                <NoteIcon />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmVoid(true);
                }}
                title="Void item"
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `${T.bad}18`,
                  border: `1px solid ${T.bad}44`,
                  color: T.bad,
                  borderRadius: T.radius,
                  cursor: "pointer",
                  ...(m3 && {
                    ...m3Icon,
                    background: m3.badContainer,
                    color: m3.onBadContainer,
                  }),
                }}
              >
                <TrashIcon />
              </button>
            </div>
          )}

          {/* Void reason picker */}
          {selected && confirmVoid && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: 4,
                padding: "8px 10px",
                background: `${T.bad}0E`,
                border: `1px solid ${T.bad}44`,
                borderRadius: T.radius,
                ...(m3 && {
                  padding: "10px 12px",
                  background: m3.badTint,
                  border: "none",
                  borderRadius: 14,
                }),
              }}
            >
              <div
                style={
                  m3
                    ? {
                        fontSize: 12,
                        fontWeight: 500,
                        color: m3.onBadContainer,
                        marginBottom: 8,
                      }
                    : {
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: T.bad,
                        marginBottom: 6,
                      }
                }
              >
                Void reason
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                {VOID_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => onVoid(line.lineId, r)}
                    style={{
                      padding: "3px 9px",
                      fontSize: 11,
                      fontFamily: "inherit",
                      background: "transparent",
                      border: `1px solid ${T.bad}66`,
                      color: T.bad,
                      borderRadius: T.radius,
                      cursor: "pointer",
                      ...(m3 && {
                        padding: "0 14px",
                        minHeight: 36,
                        fontSize: 12,
                        fontWeight: 500,
                        background: m3.badContainer,
                        color: m3.onBadContainer,
                        border: "none",
                        borderRadius: 18,
                      }),
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setConfirmVoid(false)}
                style={{
                  fontSize: 11,
                  background: "none",
                  border: "none",
                  color: T.textMute,
                  cursor: "pointer",
                  padding: 0,
                  ...(m3 && {
                    fontSize: 12,
                    fontWeight: 500,
                    color: T.textDim,
                    minHeight: 32,
                    padding: "0 4px",
                  }),
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
