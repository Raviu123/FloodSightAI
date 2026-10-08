"use client";

import { cn } from "@/lib/utils";
import { GripHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MapOverlayCardProps {
    label: string;
    children: React.ReactNode;
    className?: string;
    onClose?: () => void;
}

export function MapOverlayCard({ label, children, className, onClose }: MapOverlayCardProps) {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragStartRef = useRef({ x: 0, y: 0 });
    const offsetStartRef = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const rafIdRef = useRef<number | null>(null);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        offsetStartRef.current = offset;
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;

        const currentX = event.clientX;
        const currentY = event.clientY;

        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
        }

        rafIdRef.current = requestAnimationFrame(() => {
            setOffset({
                x: offsetStartRef.current.x + currentX - dragStartRef.current.x,
                y: offsetStartRef.current.y + currentY - dragStartRef.current.y,
            });
        });
    };

    const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        } catch (_) {
            // Ignore capture release errors
        }
    };

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    return (
        <section
            className={cn(
                "overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl backdrop-blur-md will-change-transform select-none",
                className,
            )}
            style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
        >
            <div
                className="flex h-7 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-2.5 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 cursor-grab touch-none active:cursor-grabbing hover:bg-zinc-850/80 transition-colors"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
            >
                <span className="flex items-center gap-1.5">
                    <GripHorizontal className="h-3 w-3 text-zinc-500" />
                    {label}
                </span>
                {onClose && (
                    <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 cursor-pointer"
                        aria-label={`Close ${label}`}
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>
            {children}
        </section>
    );
}
