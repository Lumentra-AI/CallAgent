import { ThemeProvider } from "@/context/ThemeContext";
import { ConfigProvider } from "@/context/ConfigContext";
import { AuthProvider } from "@/context/AuthContext";
import { TenantProvider } from "@/context/TenantContext";

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TenantProvider>
          <ConfigProvider>{children}</ConfigProvider>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
