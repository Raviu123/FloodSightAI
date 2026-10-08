"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavDocuments({
    items,
}: {
    items: {
        name: string;
        url: string;
        icon: LucideIcon;
        status?: string;
        statusVariant?: "default" | "destructive" | "outline" | "secondary";
    }[];
}) {
    return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2 py-2">
            <SidebarGroupLabel className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground flex items-center justify-between">
                <span>Estuary Telemetry Nodes</span>
                <span className="text-[9px] text-muted-foreground/80">LIVE</span>
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1.5">
                {items.map(item => (
                    <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                            asChild
                            size="sm"
                            className="h-8 rounded-lg border border-transparent px-3 transition-colors hover:border-sidebar-border/70 hover:bg-sidebar-accent"
                        >
                            <Link href={item.url} className="flex items-center justify-between group">
                                <div className="flex items-center gap-2 truncate">
                                    <item.icon className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                                    <span className="truncate text-xs font-mono">{item.name}</span>
                                </div>
                                {item.status && (
                                    <span
                                        className={`ml-auto text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                            item.statusVariant === "destructive"
                                                ? "border-red-800/80 bg-red-950/40 text-red-400"
                                                : item.statusVariant === "default"
                                                  ? "border-amber-700/80 bg-amber-950/40 text-amber-300"
                                                  : "border-border bg-secondary text-muted-foreground"
                                        }`}
                                    >
                                        {item.status}
                                    </span>
                                )}
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
