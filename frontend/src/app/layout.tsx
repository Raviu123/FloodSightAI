import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

const poppins = Poppins({
    variable: "--font-poppins",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
    title: "FloodSight AI — Coastal Flood Intelligence & Early Warning System",
    description:
        "AI-powered coastal flood prediction, zone vulnerability mapping, simulation engine, and emergency evacuation intelligence.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={`dark ${inter.variable} ${poppins.variable} h-full antialiased`}
        >
            <body
                suppressHydrationWarning
                className="min-h-full flex flex-col bg-[#070709] text-foreground antialiased selection:bg-sky-500 selection:text-white font-sans"
            >
                <DashboardShell>{children}</DashboardShell>
            </body>
        </html>
    );
}
