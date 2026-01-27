"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Simulate verification delay
    const timer = setTimeout(() => {
      setIsVerifying(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center"
      >
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10"
          >
            <CheckCircle className="h-10 w-10 text-green-500" />
          </motion.div>

          <h1 className="text-2xl font-bold text-foreground">
            Welcome to Lumentra!
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your subscription is now active. Let&apos;s set up your AI voice
            agent.
          </p>

          {isVerifying ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Activating your account...</span>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <Link href="/dashboard">
                <Button className="w-full h-12">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                Need help?{" "}
                <Link href="/help" className="text-primary hover:underline">
                  Contact support
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-foreground">1</div>
            <p className="text-xs text-muted-foreground">Configure agent</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">2</div>
            <p className="text-xs text-muted-foreground">Connect number</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">3</div>
            <p className="text-xs text-muted-foreground">Go live!</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
