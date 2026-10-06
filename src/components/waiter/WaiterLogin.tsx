"use client";

import { useState, useRef, useEffect } from "react";
import { getClient } from "@/lib/supabase";
import { useTheme } from "@/lib/ThemeContext";

interface StaffUser {
  id: string;
  name: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function staffEmail(name: string): string {
  return `thebackyardprojectph+${name.toLowerCase().replace(/\s+/g, "")}@gmail.com`;
}

interface Props {
  onLogin: (userId: string, name: string) => void;
}

export default function WaiterLogin({ onLogin }: Props) {
  const { T, isDark, toggle } = useTheme();
  const m3 = T.m3;
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getClient()
      .from("users")
      .select("id, name")
      .eq("role", "waiter")
      .eq("account_status", "active")
      .order("name")
      .then(({ data }) => {
        setUsers(data ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selected) {
      setPassword("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [selected]);

  async function handleLogin() {
    if (!selected || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    const sb = getClient();
    const { data, error: authErr } = await sb.auth.signInWithPassword({
      email: staffEmail(selected.name),
      password,
    });
    if (authErr || !data.user) {
      setError("Incorrect password.");
      setPassword("");
      setTimeout(() => inputRef.current?.focus(), 50);
      setSubmitting(false);
      return;
    }
    await sb.from("audit_logs").insert({
      user_id: selected.id,
      actor_id: selected.id,
      event: "sign_in",
    });
    onLogin(selected.id, selected.name);
    setSubmitting(false);
  }

  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        fontFamily: T.sansBody,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "12px 16px",
        }}
      >
        <button
          onClick={toggle}
          style={{
            background: T.surface,
            border: `1px solid ${T.line2}`,
            borderRadius: T.radiusLg,
            padding: "6px 10px",
            color: T.textDim,
            fontSize: 16,
            cursor: "pointer",
            lineHeight: 1,
            ...(m3 && {
              background: m3.containerHigh,
              border: "none",
              borderRadius: 22,
              minWidth: 44,
              minHeight: 44,
            }),
          }}
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 32px 48px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: T.accent,
              color: T.accentInk,
              borderRadius: T.radiusLg,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            B
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
            The Backyard Project
          </div>
          <div
            style={{
              fontSize: 11,
              color: T.headerText,
              fontFamily: T.mono,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginTop: 4,
              ...(m3 && {
                fontSize: 14,
                fontFamily: T.sansBody,
                letterSpacing: "normal",
                textTransform: "none",
                color: T.textDim,
              }),
            }}
          >
            Waiter Access
          </div>
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: T.textMute, fontFamily: T.mono }}>
            Loading...
          </div>
        ) : !selected ? (
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              ...(m3 && {
                background: m3.container,
                borderRadius: 28,
                padding: 20,
                boxShadow: m3.elev1,
                boxSizing: "border-box",
              }),
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: T.textMute,
                marginBottom: 12,
                ...(m3 && {
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "normal",
                  textTransform: "none",
                  color: T.text,
                }),
              }}
            >
              Select your name
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  style={{
                    padding: "14px 16px",
                    background: T.surface,
                    border: `1px solid ${T.line2}`,
                    borderRadius: T.radiusLg,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "background 0.12s ease",
                    ...(m3 && {
                      background: m3.containerHigh,
                      border: "none",
                      borderRadius: 20,
                      minHeight: 68,
                    }),
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: T.chip,
                      border: `1px solid ${T.line2}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: T.text,
                      ...(m3 && {
                        background: m3.primaryContainer,
                        border: "none",
                        color: m3.onPrimaryContainer,
                      }),
                    }}
                  >
                    {initials(u.name)}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                    {u.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              ...(m3 && {
                background: m3.container,
                borderRadius: 28,
                padding: 20,
                boxShadow: m3.elev1,
                boxSizing: "border-box",
              }),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <button
                onClick={() => {
                  setSelected(null);
                  setError(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.textMute,
                  fontSize: 13,
                  padding: "4px 0",
                  fontFamily: "inherit",
                  ...(m3 && {
                    background: m3.containerHigh,
                    borderRadius: 22,
                    minHeight: 44,
                    padding: "0 16px",
                    color: T.text,
                    fontWeight: 600,
                  }),
                }}
              >
                ← Back
              </button>
              {!m3 && (
                <div style={{ width: 1, height: 16, background: T.line }} />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: T.chip,
                    border: `1px solid ${T.line2}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.text,
                    ...(m3 && {
                      width: 36,
                      height: 36,
                      background: m3.primaryContainer,
                      border: "none",
                      color: m3.onPrimaryContainer,
                    }),
                  }}
                >
                  {initials(selected.name)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                  {selected.name}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: T.textMute,
                marginBottom: 8,
                ...(m3 && {
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "normal",
                  textTransform: "none",
                  color: T.textDim,
                }),
              }}
            >
              Password
            </div>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter password..."
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 14,
                boxSizing: "border-box",
                background: T.surface,
                border: `1px solid ${error ? T.bad : T.line2}`,
                color: T.text,
                fontFamily: "inherit",
                borderRadius: T.radius,
                outline: "none",
                ...(m3 && {
                  background: m3.containerHigh,
                  border: error
                    ? `1px solid ${T.bad}`
                    : "1px solid transparent",
                  borderRadius: 12,
                  minHeight: 48,
                }),
              }}
            />
            {error && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: T.bad,
                  fontFamily: T.mono,
                }}
              >
                {error}
              </div>
            )}
            <button
              onClick={handleLogin}
              disabled={!password || submitting}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "12px",
                fontSize: 14,
                fontWeight: 700,
                background: password && !submitting ? T.accent : T.chip,
                color: password && !submitting ? T.accentInk : T.textMute,
                border: "none",
                borderRadius: T.radius,
                cursor: password && !submitting ? "pointer" : "default",
                fontFamily: "inherit",
                transition: "background 0.12s ease",
                ...(m3 && {
                  background:
                    password && !submitting ? T.accent : m3.containerHighest,
                  borderRadius: 24,
                  minHeight: 48,
                }),
              }}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
