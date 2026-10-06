"use client";

import { useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import ModalBase from "./ModalBase";

const VOID_REASONS = [
  "Wrong item",
  "Changed mind",
  "Unavailable",
  "Duplicate",
] as const;

interface BulkVoidModalProps {
  count: number;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function BulkVoidModal({
  count,
  onConfirm,
  onClose,
}: BulkVoidModalProps) {
  const { T } = useTheme();
  const [reason, setReason] = useState<string | null>(null);

  return (
    <ModalBase width={400} onBackdropClick={onClose}>
      <div
        style={{
          padding: T.m3 ? "24px" : "28px 32px 24px",
          display: "flex",
          flexDirection: "column",
          gap: T.m3 ? 16 : 20,
        }}
      >
        <div
          style={{
            fontSize: T.m3 ? 20 : 17,
            fontWeight: T.m3 ? 600 : 700,
            color: T.bad,
            letterSpacing: T.m3 ? 0 : "-0.01em",
          }}
        >
          Void {count} item{count !== 1 ? "s" : ""}
        </div>

        <div
          style={
            T.m3
              ? { fontSize: 12, fontWeight: 500, color: T.textDim }
              : {
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: T.textMute,
                }
          }
        >
          Reason
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: T.m3 ? 8 : 6 }}>
          {VOID_REASONS.map((r) => {
            const active = reason === r;
            return (
              <button
                key={r}
                onClick={() => setReason(r)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontFamily: "inherit",
                  fontWeight: 500,
                  background: active ? `${T.bad}18` : T.chip,
                  border: `1px solid ${active ? T.bad : T.line2}`,
                  color: active ? T.bad : T.textDim,
                  borderRadius: T.radius,
                  cursor: "pointer",
                  transition:
                    "background 0.12s ease, border-color 0.12s ease, color 0.12s ease",
                  ...(T.m3 && {
                    minHeight: 40,
                    padding: "0 16px",
                    border: "none",
                    borderRadius: 20,
                    background: active ? T.m3.badContainer : T.m3.containerHigh,
                    color: active ? T.m3.onBadContainer : T.textDim,
                  }),
                }}
              >
                {r}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              background: "transparent",
              border: `1px solid ${T.line2}`,
              color: T.textDim,
              borderRadius: T.radius,
              cursor: "pointer",
              ...(T.m3 && {
                minHeight: 48,
                background: T.m3.containerHigh,
                border: "none",
                color: T.text,
                borderRadius: 24,
              }),
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason}
            style={{
              flex: 2,
              padding: "12px 0",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              background: reason ? T.bad : T.chip,
              color: reason ? "#fff" : T.textMute,
              border: "none",
              borderRadius: T.radius,
              cursor: reason ? "pointer" : "not-allowed",
              transition: "background 0.12s ease, color 0.12s ease",
              ...(T.m3 && {
                minHeight: 48,
                borderRadius: 24,
                background: reason ? T.m3.badContainer : T.m3.containerHigh,
                color: reason ? T.m3.onBadContainer : T.textMute,
              }),
            }}
          >
            Confirm Void
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
