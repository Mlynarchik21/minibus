export default function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f7fb",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "360px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          padding: "32px 24px",
          boxSizing: "border-box",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            margin: "0 auto 20px",
            borderRadius: "50%",
            border: "5px solid #e5e7eb",
            borderTop: "5px solid #2563eb",
            animation: "spin 1s linear infinite",
          }}
        />

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "22px",
            fontWeight: "700",
          }}
        >
          Загрузка
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: "15px",
            lineHeight: "22px",
            color: "#6b7280",
          }}
        >
          Подготавливаем ваше мини-приложение...
        </p>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
