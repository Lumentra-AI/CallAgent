import { ThemeProvider } from "@/context/ThemeContext";
import { ConfigProvider } from "@/context/ConfigContext";

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ConfigProvider>{children}</ConfigProvider>
    </ThemeProvider>
  );
}
