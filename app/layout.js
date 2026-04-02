export const metadata = {
  title: "Telegram Mini App",
  description: "My first mini app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
