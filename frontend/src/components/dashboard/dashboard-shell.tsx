"use client";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import * as React from "react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <TooltipProvider>
            {/* The outer gutter wrapper uses bg-sidebar / pure dark backdrop */}
            <SidebarProvider
                className="bg-[#070709] min-h-screen"
                style={
                    {
                        "--sidebar-width": "calc(var(--spacing) * 72)",
                        "--header-height": "calc(var(--spacing) * 12)",
                    } as React.CSSProperties
                }
            >
                <AppSidebar variant="inset" />

                {/* 
                  m-1.5 md:m-2.5 creates the inset floating card gap around the body.
                  rounded-2xl md:rounded-3xl gives the smooth curved floating dashboard look matching target design.
                */}
                <SidebarInset className="relative m-1.5 md:m-2.5 border border-zinc-800/70 bg-[#09090c] shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden flex flex-col flex-1">
                    <SiteHeader />
                    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar">
                        <div className="@container/main flex flex-1 flex-col p-3 md:p-5 gap-5">{children}</div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </TooltipProvider>
    );
}
