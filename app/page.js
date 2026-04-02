export default function Home() {
  return (
    <main style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>🚀 Telegram Mini App</h1>
      <p>Первый экран приложения работает.</p>
      <button
        style={{
          marginTop: 20,
          padding: "12px 20px",
          borderRadius: 12,
          border: "none",
          background: "#0070f3",
          color: "white",
          fontSize: 16,
          cursor: "pointer"
        }}
      >
        Открыть приложение
      </button>
    </main>
  );
}
