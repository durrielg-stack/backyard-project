"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useOrder } from "@/hooks/useOrder";

interface Props {
  tableId: string;
  waiterId: string;
  waiterName: string;
  onAddItems: () => void;
  onBack: () => void;
}

function fmtPeso(n: number) {
  return (
    "₱" +
    n.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

export default function WaiterTableView({
  tableId,
  waiterId,
  waiterName,
  onAddItems,
  onBack,
}: Props) {
  const { T, isDark, toggle } = useTheme();
  const m3 = T.m3;
  const { lines, loading } = useOrder(tableId, waiterId);

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

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  return (
    <div
      className="bp-waiter-root"
      style={{
        background: T.bg,
        height: "100dvh",
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
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: T.info,
            fontSize: 14,
            fontFamily: "inherit",
            padding: "10px 8px",
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            ...(m3 && {
              background: m3.containerHigh,
              borderRadius: 22,
              padding: "0 16px",
              color: T.text,
              fontWeight: 600,
            }),
          }}
        >
          ← Tables
        </button>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.text,
            ...(m3 && { fontSize: 20, fontWeight: 600 }),
          }}
        >
          {tableId}
        </div>
        <button
          onClick={toggle}
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
      </div>

      {/* Order lines */}
      <div
        className="bp-scroll-y"
        style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}
      >
        {loading ? (
          <div
            style={{
              color: T.textMute,
              fontSize: 13,
              fontFamily: T.mono,
              padding: "24px 0",
              textAlign: "center",
            }}
          >
            Loading order…
          </div>
        ) : lines.length === 0 ? (
          <div
            style={{
              color: T.textMute,
              fontSize: 13,
              padding: "32px 0",
              textAlign: "center",
            }}
          >
            No items yet — tap Add Items to start.
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.textMute,
                paddingBottom: 8,
                borderBottom: `1px solid ${T.line}`,
                marginBottom: 4,
                ...(m3 && {
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "normal",
                  textTransform: "none",
                  color: T.text,
                  borderBottom: "none",
                  marginBottom: 8,
                }),
              }}
            >
              Current Order
            </div>
            {lines.map((line) => (
              <div
                key={line.lineId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "10px 0",
                  borderBottom: `1px solid ${T.line}`,
                  ...(m3 && {
                    background: m3.containerHigh,
                    borderBottom: "none",
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 6,
                  }),
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: T.text }}>
                    {line.itemName}
                  </div>
                  {line.note && (
                    <div
                      style={{
                        fontSize: 11,
                        color: T.textMute,
                        marginTop: 2,
                        fontStyle: "italic",
                      }}
                    >
                      {line.note}
                    </div>
                  )}
                </div>
                <div
                  style={{ fontSize: 12, color: T.textDim, margin: "0 12px" }}
                >
                  ×{line.qty}
                </div>
                <div
                  style={{ fontSize: 13, color: T.textDim, fontFamily: T.mono }}
                >
                  {fmtPeso(line.unitPrice * line.qty)}
                </div>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 700,
                color: T.text,
                ...(m3 && {
                  background: m3.primaryContainer,
                  color: m3.onPrimaryContainerStrong,
                  borderRadius: 16,
                  padding: "14px 16px",
                  marginTop: 10,
                  fontSize: 15,
                }),
              }}
            >
              <span>Running Total</span>
              <span style={{ color: m3 ? m3.onPrimaryContainer : T.ok }}>
                {fmtPeso(total)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Add Items button */}
      <div
        style={{
          padding: `12px 16px calc(12px + env(safe-area-inset-bottom, 0px))`,
          borderTop: `1px solid ${T.line}`,
          background: T.surface,
          ...(m3 && { borderTop: "none", background: m3.topBar }),
        }}
      >
        <button
          onClick={onAddItems}
          style={{
            width: "100%",
            padding: "15px",
            fontSize: 15,
            fontWeight: 700,
            background: T.accent,
            color: T.accentInk,
            border: "none",
            borderRadius: T.radius,
            cursor: "pointer",
            fontFamily: "inherit",
            ...(m3 && { borderRadius: 28, minHeight: 52 }),
          }}
        >
          + Add Items
        </button>
      </div>
    </div>
  );
}
