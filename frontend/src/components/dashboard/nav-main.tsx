"use client";

import type { LucideIcon } from "lucide-react";
import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavMain({
    items,
}: {
    items: {
        title: string;
        url: string;
        icon?: LucideIcon;
        badge?: string;
    }[];
}) {
    const pathname = usePathname();

    return (
        <SidebarGroup className="px-2 py-3">
            <SidebarGroupLabel className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                Routes
            </SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-2">
                <SidebarMenu>
                    {items.map(item => {
                        const Icon = item.icon || SlidersHorizontal;
                        const active = pathname === item.url;

                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    tooltip={item.title}
                                    className={`h-9 rounded-lg border px-3 font-mono text-xs transition-colors ${
                                        active
                                            ? "border-zinc-700/60 bg-zinc-800/60 text-zinc-100 font-medium shadow-xs"
                                            : "border-transparent text-sidebar-foreground/75 hover:border-sidebar-border/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    }`}
                                >
                                    <Link href={item.url}>
                                        <Icon className="size-3.5" />
                                        <span className="font-medium tracking-tight">{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
