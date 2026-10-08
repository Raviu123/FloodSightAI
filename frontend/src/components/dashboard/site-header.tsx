"use client";

import { Sliders } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
    const pathname = usePathname();

    const [utcTime, setUtcTime] = React.useState<string>("");

    React.useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setUtcTime(now.toISOString().substring(11, 19) + " UTC");
        };
        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, []);

    const getPageInfo = () => {
        switch (pathname) {
            case "/simulation":
                return { section: "Hydrology", page: "Simulation & Surge Engine" };
            case "/alerts":
                return { section: "Emergency", page: "Hazard Matrix & Evacuation" };
            case "/analytics":
                return { section: "Intelligence", page: "Neural Decision Analytics" };
            default:
                return { section: "Telemetry", page: "Mission Control Overview" };
        }
    };

    const { section, page } = getPageInfo();

    return (
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/80 bg-background/95 backdrop-blur px-4 lg:px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) z-10 sticky top-0">
            <div className="flex w-full items-center gap-2 lg:gap-3">
                <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
                <Separator orientation="vertical" className="mx-1 h-4" />
                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="hidden lg:flex font-mono text-xs h-8 border-border"
                    >
                        <Link href="/simulation">
                            <Sliders className="size-3.5 mr-1.5" />
                            Surge Model
                        </Link>
                    </Button>
                </div>
            </div>
        </header>
    );
}
