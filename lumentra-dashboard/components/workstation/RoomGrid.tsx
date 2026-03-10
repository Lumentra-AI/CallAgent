"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BedDouble,
  CheckCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  User,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RoomStatus =
  | "available"
  | "occupied"
  | "checkout"
  | "cleaning"
  | "maintenance"
  | "reserved";

export interface HotelRoom {
  id: string;
  number: string;
  floor: number;
  type: string;
  status: RoomStatus;
  guestName?: string;
  checkoutTime?: string;
  isVip?: boolean;
  notes?: string;
}

interface RoomGridProps {
  rooms?: HotelRoom[];
  title?: string;
  onRoomClick?: (room: HotelRoom) => void;
  className?: string;
  viewMode?: "grid" | "floor";
}

const STATUS_CONFIG = {
  available: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    label: "Available",
  },
  occupied: {
    icon: User,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Occupied",
  },
  checkout: {
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Checkout",
  },
  cleaning: {
    icon: Sparkles,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    label: "Cleaning",
  },
  maintenance: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Maintenance",
  },
  reserved: {
    icon: BedDouble,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    label: "Reserved",
  },
};

export function RoomGrid({
  rooms = [],
  title = "Room Status",
  onRoomClick,
  className,
  viewMode = "grid",
}: RoomGridProps) {
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null);
  const [filter, setFilter] = useState<RoomStatus | "all">("all");

  // Group rooms by floor
  const roomsByFloor = useMemo(() => {
    const grouped = rooms.reduce(
      (acc, room) => {
        if (!acc[room.floor]) {
          acc[room.floor] = [];
        }
        acc[room.floor].push(room);
        return acc;
      },
      {} as Record<number, HotelRoom[]>,
    );
    return grouped;
  }, [rooms]);

  // Get status counts
  const statusCounts = useMemo(() => {
    return {
      available: rooms.filter((r) => r.status === "available").length,
      occupied: rooms.filter((r) => r.status === "occupied").length,
      checkout: rooms.filter((r) => r.status === "checkout").length,
      cleaning: rooms.filter((r) => r.status === "cleaning").length,
      maintenance: rooms.filter((r) => r.status === "maintenance").length,
      reserved: rooms.filter((r) => r.status === "reserved").length,
    };
  }, [rooms]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    if (filter === "all") return rooms;
    return rooms.filter((r) => r.status === filter);
  }, [rooms, filter]);

  const renderRoom = (room: HotelRoom, index: number) => {
    const status = STATUS_CONFIG[room.status];
    const StatusIcon = status.icon;

    return (
      <motion.div
        key={room.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.02 }}
        onClick={() => onRoomClick?.(room)}
        className={cn(
          "group relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 cursor-pointer",
          "hover:shadow-soft hover:scale-105",
          status.border,
          status.bg,
        )}
      >
        {/* VIP indicator */}
        {room.isVip && (
          <div className="absolute -top-1 -right-1">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          </div>
        )}

        {/* Room number */}
        <span className="text-lg font-bold text-foreground">{room.number}</span>

        {/* Status icon */}
        <StatusIcon className={cn("h-4 w-4 mt-1", status.color)} />

        {/* Room type */}
        <span className="text-[10px] text-muted-foreground mt-0.5">
          {room.type}
        </span>

        {/* Guest name or checkout time on hover */}
        {(room.guestName || room.checkoutTime) && (
          <div className="absolute inset-x-0 -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <div className="bg-popover border border-border rounded-md px-2 py-1 text-[10px] text-center shadow-lg">
              {room.guestName && (
                <p className="text-foreground font-medium truncate">
                  {room.guestName}
                </p>
              )}
              {room.checkoutTime && (
                <p className="text-muted-foreground">
                  Out: {room.checkoutTime}
                </p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderFloorSection = (floor: number, floorRooms: HotelRoom[]) => {
    const isExpanded = expandedFloor === floor || expandedFloor === null;
    const displayRooms =
      filter === "all"
        ? floorRooms
        : floorRooms.filter((r) => r.status === filter);

    if (displayRooms.length === 0) return null;

    return (
      <div key={floor} className="space-y-2">
        <button
          onClick={() =>
            setExpandedFloor(expandedFloor === floor ? null : floor)
          }
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Floor {floor}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {displayRooms.length} rooms
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </div>
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="grid grid-cols-4 sm:grid-cols-6 gap-2 overflow-hidden"
            >
              {displayRooms.map((room, idx) => renderRoom(room, idx))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className={cn("card-soft p-4", className)}>
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BedDouble className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-2 py-1 text-xs rounded-md transition-colors",
              filter === "all"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            All ({rooms.length})
          </button>
          {(
            ["available", "checkout", "cleaning", "occupied"] as RoomStatus[]
          ).map((status) => {
            const config = STATUS_CONFIG[status];
            const count = statusCounts[status];
            if (count === 0) return null;
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1",
                  filter === status
                    ? cn(config.bg, config.color, "font-medium")
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BedDouble className="h-10 w-10 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            No rooms match the current filter
          </p>
        </div>
      ) : viewMode === "floor" ? (
        <div className="space-y-4">
          {Object.entries(roomsByFloor)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([floor, floorRooms]) =>
              renderFloorSection(Number(floor), floorRooms),
            )}
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {filteredRooms.map((room, idx) => renderRoom(room, idx))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", config.bg)} />
            <span className="text-[10px] text-muted-foreground">
              {config.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
