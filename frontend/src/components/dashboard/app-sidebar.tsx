"use client";

import {
    Activity,
    Bell,
    Cpu,
    FileText,
    HelpCircle,
    LayoutDashboard,
    Radio,
    Shield,
    Sliders,
    Waves,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { NavDocuments } from "@/components/dashboard/nav-documents";
import { NavMain } from "@/components/dashboard/nav-main";
import { NavUser } from "@/components/dashboard/nav-user";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

const telemetryData = {
    user: {
        name: "Alex Rivera",
        email: "commander@floodsight.ai",
        role: "INCIDENT COMMANDER",
        initials: "AR",
    },
    navMain: [
        {
            title: "Mission Control",
            url: "/",
            icon: LayoutDashboard,
            badge: "LIVE",
        },
        {
            title: "Simulation & Surge",
            url: "/simulation",
            icon: Sliders,
        },
        {
            title: "Hazard & Evacuation",
            url: "/alerts",
            icon: Bell,
            badge: "2 WARN",
        },
        {
            title: "Neural Decision Trees",
            url: "/analytics",
            icon: Cpu,
        },
    ],
    estuaries: [
        {
            name: "Netravati Estuary",
            url: "/simulation",
            icon: Waves,
            status: "3.42m CRITICAL",
            statusVariant: "destructive" as const,
        },
        {
            name: "Vembanad Lowlands",
            url: "/simulation",
            icon: Waves,
            status: "2.85m HIGH",
            statusVariant: "default" as const,
        },
        {
            name: "Hooghly Tidal Reach",
            url: "/simulation",
            icon: Waves,
            status: "1.95m NORMAL",
            statusVariant: "outline" as const,
        },
        {
            name: "Mandovi Basin",
            url: "/simulation",
            icon: Waves,
            status: "1.40m STABLE",
            statusVariant: "outline" as const,
        },
    ],
    navSecondary: [
        {
            title: "SAR Satellite Pass (Sentinel-1)",
            url: "#",
            icon: Radio,
        },
        {
            title: "Disaster SOP Directives",
            url: "#",
            icon: FileText,
        },
        {
            title: "Operational Telemetry Grid",
            url: "#",
            icon: Activity,
        },
        {
            title: "System Architecture & Docs",
            url: "#",
            icon: HelpCircle,
        },
    ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="icon" {...props} className="bg-sidebar border-r border-sidebar-border/80">
            <SidebarHeader className="border-b border-sidebar-border/40 py-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            size="lg"
                            className="data-[slot=sidebar-menu-button]:px-2.5 hover:bg-sidebar-accent/50 transition-colors rounded-xl"
                        >
                            <Link href="/" className="group flex items-center gap-3">
                                <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-sm transition-all duration-300 group-hover:scale-105">
                                    <Shield className="size-4.5 stroke-[2.25] text-primary" />
                                </div>
                                <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground truncate">
                                            FloodSight
                                        </span>
                                        <span className="rounded-md bg-primary/10 px-1 py-0.5 text-[9px] font-semibold tracking-wider text-primary uppercase leading-none border border-primary/20">
                                            AI
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={telemetryData.navMain} />
                <NavDocuments items={telemetryData.estuaries} />
            </SidebarContent>
            <SidebarFooter className="border-t border-sidebar-border/40 pt-2">
                <NavUser user={telemetryData.user} />
            </SidebarFooter>
        </Sidebar>
    );
}
