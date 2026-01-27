"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneIncoming,
  Calendar,
  CalendarCheck,
  User,
  UserPlus,
  LayoutDashboard,
  X,
  CheckCircle,
  Clock,
  MapPin,
} from "lucide-react";

// Demo types
type DemoType =
  | "incoming-call"
  | "booking"
  | "contact"
  | "dashboard"
  | "check-in"
  | null;

interface DemoContextType {
  activeDemo: DemoType;
  triggerDemo: (type: DemoType) => void;
  dismissDemo: () => void;
}

const DemoContext = createContext<DemoContextType>({
  activeDemo: null,
  triggerDemo: () => {},
  dismissDemo: () => {},
});

export const useDemoOrchestrator = () => useContext(DemoContext);

interface DemoOrchestratorProps {
  children: React.ReactNode;
}

export function DemoOrchestrator({ children }: DemoOrchestratorProps) {
  const [activeDemo, setActiveDemo] = useState<DemoType>(null);
  const [demoStep, setDemoStep] = useState(0);

  const triggerDemo = useCallback((type: DemoType) => {
    setActiveDemo(type);
    setDemoStep(0);

    // Auto-progress demo after delay
    if (type) {
      const progressDemo = () => {
        setDemoStep((prev) => {
          if (prev >= 3) {
            setTimeout(() => setActiveDemo(null), 2000);
            return prev;
          }
          setTimeout(progressDemo, 1500);
          return prev + 1;
        });
      };
      setTimeout(progressDemo, 1500);
    }
  }, []);

  const dismissDemo = useCallback(() => {
    setActiveDemo(null);
    setDemoStep(0);
  }, []);

  return (
    <DemoContext.Provider value={{ activeDemo, triggerDemo, dismissDemo }}>
      {children}
      <AnimatePresence>
        {activeDemo && (
          <DemoOverlay
            type={activeDemo}
            step={demoStep}
            onDismiss={dismissDemo}
          />
        )}
      </AnimatePresence>
    </DemoContext.Provider>
  );
}

// Demo overlay component
interface DemoOverlayProps {
  type: DemoType;
  step: number;
  onDismiss: () => void;
}

function DemoOverlay({ type, step, onDismiss }: DemoOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onDismiss}
    >
      {/* Close hint */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute top-6 right-6 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <span>Click anywhere to close</span>
        <X className="h-4 w-4" />
      </motion.div>

      {/* Demo content */}
      <div onClick={(e) => e.stopPropagation()}>
        {type === "incoming-call" && <IncomingCallDemo step={step} />}
        {type === "booking" && <BookingDemo step={step} />}
        {type === "contact" && <ContactDemo step={step} />}
        {type === "dashboard" && <DashboardDemo step={step} />}
        {type === "check-in" && <CheckInDemo step={step} />}
      </div>

      {/* Progress indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8 }}
            animate={{
              scale: i === step ? 1.2 : 1,
              backgroundColor:
                i <= step
                  ? "var(--industry-accent)"
                  : "var(--muted-foreground)",
            }}
            className="h-2 w-2 rounded-full"
          />
        ))}
      </div>
    </motion.div>
  );
}

// Individual demo animations
function IncomingCallDemo({ step }: { step: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="w-96 rounded-2xl bg-background border border-border shadow-elevated overflow-hidden"
    >
      {/* Phone ringing animation */}
      <div className="bg-gradient-to-br from-industry/20 to-industry/5 px-6 py-8 text-center">
        <motion.div
          animate={{
            scale: step === 0 ? [1, 1.1, 1] : 1,
            rotate: step === 0 ? [0, -5, 5, 0] : 0,
          }}
          transition={{ duration: 0.5, repeat: step === 0 ? Infinity : 0 }}
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-industry"
        >
          <PhoneIncoming className="h-10 w-10 text-white" />
        </motion.div>
        <h3 className="text-xl font-semibold text-foreground">Incoming Call</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === 0
            ? "+1 555-123-4567"
            : step === 1
              ? "AI answered: Hello, Wellness Clinic..."
              : step === 2
                ? "Booking appointment for tomorrow..."
                : "Appointment confirmed!"}
        </p>
      </div>

      {/* Call info */}
      <div className="px-6 py-4 space-y-3">
        <AnimatePresence mode="wait">
          {step >= 1 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
            >
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  John Smith
                </p>
                <p className="text-xs text-muted-foreground">
                  Returning patient
                </p>
              </div>
            </motion.div>
          )}

          {step >= 2 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
            >
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Tomorrow, 10:30 AM
                </p>
                <p className="text-xs text-muted-foreground">
                  Annual checkup with Dr. Williams
                </p>
              </div>
            </motion.div>
          )}

          {step >= 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 rounded-lg bg-green-500/10 p-3"
            >
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="text-sm font-medium text-green-600">
                Appointment booked successfully
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function BookingDemo({ step }: { step: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="w-96 rounded-2xl bg-background border border-border shadow-elevated overflow-hidden"
    >
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-industry/10">
            <CalendarCheck className="h-5 w-5 text-industry" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">New Appointment</h3>
            <p className="text-sm text-muted-foreground">
              AI is booking for you
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Patient info */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Patient
          </label>
          <motion.div
            animate={{ opacity: step >= 0 ? 1 : 0.3 }}
            className="rounded-lg border border-border p-3"
          >
            <p className="font-medium text-foreground">Sarah Johnson</p>
            <p className="text-sm text-muted-foreground">+1 555-234-5678</p>
          </motion.div>
        </div>

        {/* Date/Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Date
            </label>
            <motion.div
              animate={{ opacity: step >= 1 ? 1 : 0.3 }}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Jan 28, 2026</span>
              </div>
            </motion.div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Time
            </label>
            <motion.div
              animate={{ opacity: step >= 1 ? 1 : 0.3 }}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">2:30 PM</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Service */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Service
          </label>
          <motion.div
            animate={{ opacity: step >= 2 ? 1 : 0.3 }}
            className="rounded-lg border border-border p-3"
          >
            <p className="font-medium text-foreground">Consultation</p>
            <p className="text-sm text-muted-foreground">45 minutes</p>
          </motion.div>
        </div>

        {/* Confirm button */}
        <motion.button
          animate={{
            opacity: step >= 3 ? 1 : 0.5,
            scale: step >= 3 ? [1, 1.02, 1] : 1,
          }}
          className="w-full rounded-lg bg-industry py-3 text-sm font-medium text-white"
        >
          {step >= 3 ? "Confirmed!" : "Confirming..."}
        </motion.button>
      </div>
    </motion.div>
  );
}

function ContactDemo({ step }: { step: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="w-80 rounded-2xl bg-background border border-border shadow-elevated overflow-hidden"
    >
      <div className="bg-gradient-to-br from-industry/20 to-industry/5 px-6 py-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-industry"
        >
          <UserPlus className="h-8 w-8 text-white" />
        </motion.div>
        <h3 className="font-semibold text-foreground">New Contact Created</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          AI captured caller info
        </p>
      </div>

      <div className="px-6 py-4 space-y-3">
        <motion.div
          animate={{ opacity: step >= 0 ? 1 : 0.3 }}
          className="flex items-center gap-3"
        >
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground">Emily Davis</span>
        </motion.div>

        <motion.div
          animate={{ opacity: step >= 1 ? 1 : 0.3 }}
          className="flex items-center gap-3"
        >
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground">+1 555-345-6789</span>
        </motion.div>

        <motion.div
          animate={{ opacity: step >= 2 ? 1 : 0.3 }}
          className="flex items-center gap-3"
        >
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground">New York, NY</span>
        </motion.div>

        {step >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-lg bg-industry/10 p-3 text-center"
          >
            <p className="text-sm font-medium text-industry">
              Contact saved to CRM
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function DashboardDemo({ step }: { step: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="w-[500px] rounded-2xl bg-background border border-border shadow-elevated overflow-hidden"
    >
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <LayoutDashboard className="h-5 w-5 text-industry" />
        <h3 className="font-semibold text-foreground">Your Workstation</h3>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Today's Schedule */}
        <motion.div
          animate={{ opacity: step >= 0 ? 1 : 0.3 }}
          className="col-span-2 rounded-lg border border-border p-4"
        >
          <h4 className="text-sm font-medium text-foreground mb-3">
            Today&apos;s Schedule
          </h4>
          <div className="space-y-2">
            {[
              "9:00 AM - John Smith",
              "10:30 AM - Sarah J.",
              "2:00 PM - New",
            ].map((item, i) => (
              <motion.div
                key={item}
                animate={{ opacity: step >= i ? 1 : 0.3 }}
                className="flex items-center gap-2 text-sm"
              >
                <div className="h-2 w-2 rounded-full bg-industry" />
                <span className="text-muted-foreground">{item}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick stats */}
        <motion.div
          animate={{ opacity: step >= 2 ? 1 : 0.3 }}
          className="rounded-lg border border-border p-4"
        >
          <p className="text-2xl font-bold text-foreground">12</p>
          <p className="text-xs text-muted-foreground">Appointments today</p>
        </motion.div>

        <motion.div
          animate={{ opacity: step >= 3 ? 1 : 0.3 }}
          className="rounded-lg border border-border p-4"
        >
          <p className="text-2xl font-bold text-foreground">28</p>
          <p className="text-xs text-muted-foreground">Calls handled</p>
        </motion.div>
      </div>
    </motion.div>
  );
}

function CheckInDemo({ step }: { step: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="w-80 rounded-2xl bg-background border border-border shadow-elevated overflow-hidden"
    >
      <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 px-6 py-6 text-center">
        <motion.div
          animate={{ scale: step >= 3 ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 0.3 }}
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-500"
        >
          <CheckCircle className="h-8 w-8 text-white" />
        </motion.div>
        <h3 className="font-semibold text-foreground">Check-In Complete</h3>
      </div>

      <div className="px-6 py-4">
        <div className="space-y-3">
          <motion.div
            animate={{ opacity: step >= 0 ? 1 : 0.3 }}
            className="flex justify-between text-sm"
          >
            <span className="text-muted-foreground">Patient</span>
            <span className="font-medium text-foreground">John Smith</span>
          </motion.div>
          <motion.div
            animate={{ opacity: step >= 1 ? 1 : 0.3 }}
            className="flex justify-between text-sm"
          >
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium text-foreground">10:30 AM</span>
          </motion.div>
          <motion.div
            animate={{ opacity: step >= 2 ? 1 : 0.3 }}
            className="flex justify-between text-sm"
          >
            <span className="text-muted-foreground">Provider</span>
            <span className="font-medium text-foreground">Dr. Williams</span>
          </motion.div>
          <motion.div
            animate={{ opacity: step >= 3 ? 1 : 0.3 }}
            className="flex justify-between text-sm"
          >
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium text-green-500">Checked In</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
