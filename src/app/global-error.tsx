"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant">
      <body
        style={{
          fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
          margin: 0,
          background: "#f3f6f9",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: 420, margin: "80px auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>系統暫時無法使用</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            {error?.message?.slice(0, 120) || "請重新整理或稍後再試。"}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "#07111f",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            重試
          </button>
        </div>
      </body>
    </html>
  );
}
