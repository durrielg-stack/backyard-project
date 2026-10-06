"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase";
import { useTheme } from "@/lib/ThemeContext";

export default function ResetPasswordPage() {
  const { T } = useTheme();
  const m3 = T.m3;
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = params.get("token_hash");
    const type = params.get("type");
    if (!hash || type !== "recovery") {
      setVerifyError("Invalid or expired reset link.");
      return;
    }
    setTokenHash(hash);
    getClient()
      .auth.verifyOtp({ token_hash: hash, type: "recovery" })
      .then(({ error: err }) => {
        if (err) setVerifyError("Reset link is invalid or has expired.");
        else setSessionReady(true);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateErr } = await getClient().auth.updateUser({
      password: newPw,
    });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  }

  // Classic look is a hardcoded palette; M3 themes take the live tokens.
  const bg = m3 ? T.bg : "#0f1117";
  const surface = m3 ? m3.containerHigh : "#1a1d27";
  const accent = m3 ? T.accent : "#c87941";
  const accentInk = m3 ? T.accentInk : "#fff";
  const text = m3 ? T.text : "#e8e6e1";
  const textMute = m3 ? T.textDim : "#6b6f7a";
  const bad = m3 ? T.bad : "#e05454";
  const line2 = m3 ? "transparent" : "#2a2d3a";
  const radius = m3 ? "12px" : "2px";
  const mono = m3
    ? T.mono
    : 'ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace';
  const sans = m3 ? T.sansBody : "Inter, system-ui, sans-serif";
  const labelStyle: React.CSSProperties = m3
    ? { fontSize: 14, fontWeight: 600, color: textMute, marginBottom: 8 }
    : {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: textMute,
        marginBottom: 8,
      };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: sans,
        padding: "0 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: accent,
              color: accentInk,
              borderRadius: m3 ? 14 : "6px",
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
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: text,
              ...(m3 && { fontWeight: 600 }),
            }}
          >
            The Backyard Project
          </div>
          <div
            style={{
              fontSize: 11,
              color: textMute,
              fontFamily: mono,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginTop: 4,
              ...(m3 && {
                fontSize: 14,
                fontFamily: sans,
                letterSpacing: "normal",
                textTransform: "none",
              }),
            }}
          >
            Reset Password
          </div>
        </div>

        {!tokenHash && !verifyError ? (
          <div
            style={{
              textAlign: "center",
              color: textMute,
              fontSize: 13,
              fontFamily: mono,
            }}
          >
            Verifying link...
          </div>
        ) : verifyError ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: bad, marginBottom: 20 }}>
              {verifyError}
            </div>
            <Link href="/" style={{ color: accent, fontSize: 13 }}>
              Back to sign in
            </Link>
          </div>
        ) : success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: text, marginBottom: 8 }}>
              Password updated successfully.
            </div>
            <div style={{ fontSize: 12, color: textMute, fontFamily: mono }}>
              Redirecting to sign in...
            </div>
          </div>
        ) : sessionReady ? (
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              ...(m3 && {
                background: m3.container,
                borderRadius: 28,
                padding: 24,
                boxShadow: m3.elev1,
              }),
            }}
          >
            <div>
              <div style={labelStyle}>New Password</div>
              <input
                type="password"
                value={newPw}
                onChange={(e) => {
                  setNewPw(e.target.value);
                  setError(null);
                }}
                placeholder="Min. 8 characters"
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  fontSize: 15,
                  boxSizing: "border-box",
                  background: surface,
                  border: `1px solid ${line2}`,
                  color: text,
                  borderRadius: radius,
                  fontFamily: "inherit",
                  outline: "none",
                  ...(m3 && { minHeight: 48 }),
                }}
              />
            </div>
            <div>
              <div style={labelStyle}>Confirm New Password</div>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => {
                  setConfirmPw(e.target.value);
                  setError(null);
                }}
                placeholder="Repeat new password"
                required
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  fontSize: 15,
                  boxSizing: "border-box",
                  background: surface,
                  border: `1px solid ${error ? bad : line2}`,
                  color: text,
                  borderRadius: radius,
                  fontFamily: "inherit",
                  outline: "none",
                  ...(m3 && { minHeight: 48 }),
                }}
              />
            </div>
            {error && (
              <div style={{ fontSize: 12, color: bad, fontFamily: mono }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !newPw || !confirmPw}
              style={{
                marginTop: 4,
                padding: "14px",
                fontSize: 15,
                fontWeight: 700,
                background:
                  loading || !newPw || !confirmPw
                    ? m3
                      ? m3.containerHighest
                      : "#2a2d3a"
                    : accent,
                color: loading || !newPw || !confirmPw ? textMute : accentInk,
                border: "none",
                borderRadius: radius,
                cursor: loading || !newPw || !confirmPw ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.12s",
                ...(m3 && { borderRadius: 24, minHeight: 48 }),
              }}
            >
              {loading ? "Updating..." : "Set New Password"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
