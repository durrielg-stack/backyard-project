"use client";

import { useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { fmtDate } from "./ownerShared";
import RecipeTab from "./RecipeTab";
import MenuTab from "./MenuTab";
import InventoryTab from "./InventoryTab";

type OpsTab = "recipe" | "menu" | "inventory";

const TABS: { id: OpsTab; label: string }[] = [
  { id: "recipe", label: "Recipe" },
  { id: "menu", label: "Menu" },
  { id: "inventory", label: "Inventory" },
];

export default function OperationsView() {
  const { T } = useTheme();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const [tab, setTab] = useState<OpsTab>("recipe");
  const today = new Date();
  const m3 = T.m3;

  const tabStrip = (
    <div
      className="bp-no-scrollbar"
      style={{
        display: "flex",
        gap: 2,
        overflowX: "auto",
        touchAction: "pan-x pan-y",
        overscrollBehaviorX: "contain",
        overscrollBehaviorY: "none",
        ...(m3 && {
          gap: 4,
          padding: 3,
          background: m3.track,
          borderRadius: 18,
        }),
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={
            m3
              ? {
                  padding: "0 16px",
                  height: 34,
                  fontSize: 13,
                  fontFamily: "inherit",
                  fontWeight: tab === t.id ? 600 : 500,
                  flexShrink: 0,
                  background: tab === t.id ? T.accent : "transparent",
                  color: tab === t.id ? T.accentInk : T.textDim,
                  border: "none",
                  borderRadius: 16,
                  cursor: "pointer",
                  transition: "background 0.12s ease",
                }
              : {
                  padding: "10px 16px",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: tab === t.id ? 700 : 400,
                  flexShrink: 0,
                  background: tab === t.id ? T.surface2 : "transparent",
                  color: tab === t.id ? T.text : T.textDim,
                  border: `1px solid ${tab === t.id ? T.line2 : "transparent"}`,
                  borderRadius: T.radius,
                  cursor: "pointer",
                  borderBottom:
                    tab === t.id
                      ? `2px solid ${T.accent}`
                      : `2px solid transparent`,
                  transition: "background 0.12s ease",
                }
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: T.bg,
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      {isMobile ? (
        <div
          style={{
            flexShrink: 0,
            background: T.bg,
            borderBottom: m3 ? "none" : `1px solid ${T.line}`,
          }}
        >
          <div
            style={{
              height: 44,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={
                m3
                  ? { fontSize: 18, fontWeight: 600, color: T.text }
                  : {
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: T.accent,
                    }
              }
            >
              Operations
            </span>
            {!m3 && (
              <div style={{ width: 1, height: 16, background: T.line2 }} />
            )}
            <span
              style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}
            >
              {fmtDate(today)}
            </span>
          </div>
          <div
            style={{
              height: m3 ? 52 : 44,
              display: "flex",
              alignItems: "center",
              padding: m3 ? "0 12px" : "0 8px",
            }}
          >
            {tabStrip}
          </div>
        </div>
      ) : (
        <div
          style={{
            height: m3 ? 64 : 52,
            padding: m3 ? "0 20px" : "0 24px",
            flexShrink: 0,
            background: T.bg,
            borderBottom: m3 ? "none" : `1px solid ${T.line}`,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={
              m3
                ? { fontSize: 18, fontWeight: 600, color: T.text }
                : {
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: T.accent,
                  }
            }
          >
            Operations
          </span>
          {!m3 && <div style={{ width: 1, height: 20, background: T.line2 }} />}
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute }}>
            {fmtDate(today)}
          </span>
          <div style={{ flex: 1 }} />
          {tabStrip}
        </div>
      )}

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {tab === "recipe" && <RecipeTab />}
        {tab === "menu" && <MenuTab />}
        {tab === "inventory" && <InventoryTab />}
      </div>
    </div>
  );
}
