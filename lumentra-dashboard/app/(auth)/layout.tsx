import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">{children}</div>
      </AuthProvider>
    </ThemeProvider>
  );
}
