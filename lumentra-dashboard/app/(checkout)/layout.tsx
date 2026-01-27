import { ThemeProvider } from "@/context/ThemeContext";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">{children}</div>
    </ThemeProvider>
  );
}
