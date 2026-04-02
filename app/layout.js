export const metadata = {
  title: "Telegram Mini App",
  description: "My first Telegram mini app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
