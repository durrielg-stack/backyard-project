"use client";

import { useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type { DiscountType } from "@/lib/discounts";

interface OrderFooterProps {
  subtotal: number;
  tip: number;
  setTip: (amount: number) => void;
  discount: number;
  discountType: DiscountType;
  setDiscountType: (type: DiscountType) => void;
  seniorCount: number;
  setSeniorCount: (count: number) => void;
  total: number;
  onSplit: () => void;
  onCharge: () => void;
  disabled: boolean;
}

function TotalsRow({
  label,
  value,
  accent,
  large,
  mute,
}: {
  label: string;
  value: string;
  accent?: boolean;
  large?: boolean;
  mute?: boolean;
}) {
  const { T } = useTheme();
  // Under M3 the large row sits on the primary-container hero.
  const hero = T.m3 && large ? T.m3 : null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0",
      }}
    >
      <span
        style={{
          fontSize: large ? 13 : 12,
          fontWeight: large ? 600 : 400,
          letterSpacing: large ? "0.06em" : 0,
          textTransform: large ? "uppercase" : "none",
          color: mute ? T.textMute : T.textDim,
          ...(T.m3 && { fontSize: large ? 14 : 13 }),
          ...(hero && {
            letterSpacing: 0,
            textTransform: "none",
            fontWeight: 500,
            color: hero.onPrimaryContainer,
          }),
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: T.mono,
          fontVariantNumeric: "tabular-nums",
          fontSize: large ? 28 : 14,
          fontWeight: large ? 700 : 400,
          color: accent ? T.accent : mute ? T.textMute : T.textDim,
          letterSpacing: large ? "-0.02em" : 0,
          ...(hero && { color: hero.onPrimaryContainerStrong }),
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function OrderFooter({
  subtotal,
  tip,
  setTip,
  discount,
  discountType,
  setDiscountType,
  seniorCount,
  setSeniorCount,
  total,
  onSplit,
  onCharge,
  disabled,
}: OrderFooterProps) {
  const { T } = useTheme();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const [editingTip, setEditingTip] = useState(false);
  const [tipVal, setTipVal] = useState("");

  function applyTip() {
    const v = parseFloat(tipVal);
    setTip(!isNaN(v) && v >= 0 ? v : 0);
    setEditingTip(false);
  }

  function toggleType(type: DiscountType) {
    setDiscountType(discountType === type ? "none" : type);
  }

  const m3 = T.m3;
  const m3Chip: React.CSSProperties | undefined = m3
    ? {
        border: "none",
        borderRadius: 18,
        minHeight: 36,
        padding: "0 14px",
        fontSize: 12,
        fontWeight: 500,
        background: m3.containerHigh,
        color: T.textDim,
      }
    : undefined;
  const m3Step: React.CSSProperties | undefined = m3
    ? {
        width: 36,
        height: 36,
        border: "none",
        borderRadius: 18,
        background: m3.containerHighest,
        fontSize: 16,
      }
    : undefined;

  return (
    <div
      style={{
        borderTop: m3 ? "none" : `1px solid ${T.line}`,
        padding: isMobile
          ? "calc(18px) 16px calc(56px + env(safe-area-inset-bottom, 0px))"
          : m3
            ? "12px 16px 16px"
            : "18px 24px",
        flexShrink: 0,
        background: m3 ? m3.container : T.surface,
      }}
    >
      {/* ── Totals ──────────────────────────────────────────────────── */}
      <TotalsRow label="Subtotal" value={`₱${subtotal.toFixed(2)}`} mute />

      {/* Discount — exactly two structured types, mutually exclusive */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 0 6px",
        }}
      >
        <span style={{ fontSize: 12, color: T.textDim }}>
          Discount
          {discount > 0 && (
            <span
              style={{
                marginLeft: 6,
                fontFamily: T.mono,
                fontSize: 12,
                color: T.ok,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              −₱{discount.toFixed(2)}
            </span>
          )}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => toggleType("owner_employee")}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontFamily: "inherit",
              fontWeight: discountType === "owner_employee" ? 700 : 400,
              background:
                discountType === "owner_employee"
                  ? `${T.info}24`
                  : "transparent",
              color: discountType === "owner_employee" ? T.info : T.textDim,
              border: `1px solid ${discountType === "owner_employee" ? T.info : T.line2}`,
              borderRadius: T.radius,
              cursor: "pointer",
              transition: "background 0.12s ease",
              ...(m3 && {
                ...m3Chip,
                ...(discountType === "owner_employee" && {
                  background: m3.infoContainer,
                  color: m3.onInfoContainer,
                  fontWeight: 700,
                }),
              }),
            }}
          >
            Owner/Employee
          </button>
          <button
            onClick={() => toggleType("senior_pwd")}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontFamily: "inherit",
              fontWeight: discountType === "senior_pwd" ? 700 : 400,
              background:
                discountType === "senior_pwd" ? `${T.ok}24` : "transparent",
              color: discountType === "senior_pwd" ? T.ok : T.textDim,
              border: `1px solid ${discountType === "senior_pwd" ? T.ok : T.line2}`,
              borderRadius: T.radius,
              cursor: "pointer",
              transition: "background 0.12s ease",
              ...(m3 && {
                ...m3Chip,
                ...(discountType === "senior_pwd" && {
                  background: m3.okContainer,
                  color: m3.onOkContainer,
                  fontWeight: 700,
                }),
              }),
            }}
          >
            Senior/PWD
          </button>
        </div>
      </div>

      {/* Senior/PWD count — food items only, one unit per qualifying person */}
      {discountType === "senior_pwd" && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 0 6px",
          }}
        >
          <span style={{ fontSize: 11, color: T.textMute }}>
            # Senior/PWD applying (food items only)
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setSeniorCount(Math.max(1, seniorCount - 1))}
              style={{
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.chip,
                border: `1px solid ${T.line2}`,
                color: T.textDim,
                borderRadius: T.radius,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
                ...m3Step,
              }}
            >
              −
            </button>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 13,
                fontWeight: 700,
                color: T.text,
                minWidth: 16,
                textAlign: "center",
              }}
            >
              {seniorCount}
            </span>
            <button
              onClick={() => setSeniorCount(seniorCount + 1)}
              style={{
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.chip,
                border: `1px solid ${T.line2}`,
                color: T.textDim,
                borderRadius: T.radius,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
                ...m3Step,
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Tip row — custom amount only */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 0 10px",
        }}
      >
        <span style={{ fontSize: 12, color: T.textDim }}>
          Tip
          {tip > 0 && (
            <span
              style={{
                marginLeft: 6,
                fontFamily: T.mono,
                fontSize: 12,
                color: T.accent,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ₱{tip.toFixed(2)}
            </span>
          )}
        </span>

        {editingTip ? (
          <input
            autoFocus
            value={tipVal}
            onChange={(e) => setTipVal(e.target.value)}
            onBlur={applyTip}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applyTip();
                e.stopPropagation();
              }
              if (e.key === "Escape") {
                setEditingTip(false);
                e.stopPropagation();
              }
              e.stopPropagation();
            }}
            placeholder="0.00"
            style={{
              width: 80,
              padding: "4px 8px",
              fontSize: 12,
              background: T.surface2,
              border: `1px solid ${T.accent}`,
              color: T.text,
              fontFamily: T.mono,
              borderRadius: T.radius,
              outline: "none",
              ...(m3 && {
                width: 110,
                minHeight: 36,
                padding: "0 12px",
                fontSize: 13,
                background: m3.containerHigh,
                borderRadius: 12,
                boxSizing: "border-box",
              }),
            }}
          />
        ) : (
          <button
            onClick={() => {
              setTipVal(tip > 0 ? tip.toFixed(2) : "");
              setEditingTip(true);
            }}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontFamily: "inherit",
              background: tip > 0 ? `${T.accent}24` : "transparent",
              color: tip > 0 ? T.accent : T.textDim,
              border: `1px solid ${tip > 0 ? T.accent : T.line2}`,
              borderRadius: T.radius,
              cursor: "pointer",
              transition: "background 0.12s ease",
              ...(m3 && {
                ...m3Chip,
                ...(tip > 0 && {
                  background: m3.primaryContainer,
                  color: m3.onPrimaryContainer,
                }),
              }),
            }}
          >
            {tip > 0 ? "Edit" : "Add tip"}
          </button>
        )}
      </div>

      {/* ── Total row ───────────────────────────────────────────────── */}
      <div
        style={
          m3
            ? {
                background: m3.primaryContainer,
                borderRadius: 20,
                padding: "10px 18px",
                marginBottom: 12,
              }
            : {
                borderTop: `1px solid ${T.line}`,
                paddingTop: 10,
                marginBottom: 16,
              }
        }
      >
        <TotalsRow label="Total" value={`₱${total.toFixed(2)}`} large accent />
      </div>

      {/* ── Action buttons — 1fr 2fr ────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <button
          onClick={onSplit}
          disabled={disabled}
          style={{
            padding: "13px 0",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            background: "transparent",
            border: `1px solid ${T.line2}`,
            color: disabled ? T.textMute : T.textDim,
            borderRadius: T.radius,
            cursor: disabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "border-color 0.12s ease, color 0.12s ease",
            ...(m3 && {
              minHeight: 56,
              padding: "0 16px",
              fontSize: 14,
              background: m3.containerHigh,
              border: "none",
              borderRadius: 28,
              color: disabled ? T.textMute : T.text,
            }),
          }}
        >
          Split
          <span
            style={{
              fontSize: 10,
              fontFamily: T.mono,
              color: T.textMute,
              border: `1px solid ${T.line2}`,
              padding: "1px 4px",
              borderRadius: 2,
              ...(m3 && {
                border: "none",
                background: m3.containerHighest,
                padding: "2px 6px",
                borderRadius: 8,
              }),
            }}
          >
            S
          </span>
        </button>

        <button
          onClick={onCharge}
          disabled={disabled}
          style={{
            padding: "13px 0",
            fontFamily: "inherit",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            background: disabled ? T.chip : T.accent,
            color: disabled ? T.textMute : T.accentInk,
            border: "none",
            borderRadius: T.radius,
            cursor: disabled ? "not-allowed" : "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            transition: "background 0.12s ease",
            ...(m3 && {
              minHeight: 56,
              padding: "6px 16px",
              textTransform: "none",
              letterSpacing: 0,
              borderRadius: 28,
              background: disabled ? m3.containerHigh : T.accent,
            }),
          }}
        >
          <span>Bill Out · ₱{total.toFixed(2)}</span>
          <span
            style={{
              fontSize: 10,
              fontFamily: T.mono,
              color: disabled ? T.textMute : `${T.accentInk}88`,
              fontWeight: 400,
              letterSpacing: "0.04em",
            }}
          >
            ↵ ENTER
          </span>
        </button>
      </div>
    </div>
  );
}
