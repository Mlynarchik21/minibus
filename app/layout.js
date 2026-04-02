export const metadata = {
  title: "MiniBus",
  description: "Telegram Mini App for route booking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#f5f7fb",
          color: "#111",
        }}
      >
        {children}
      </body>
    </html>
  );
}
