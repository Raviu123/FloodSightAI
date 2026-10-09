"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Bot,
    Send,
    User,
    Shield,
    Flame,
    Zap,
    History,
    BarChart3,
    Compass,
    Volume2,
    CheckCircle2,
    AlertTriangle,
    Layers,
    X,
    Maximize2,
    Minimize2,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Terminal,
    Copy,
    Check,
} from "lucide-react";
import { chatWithCopilot } from "@/lib/api";
import { ChatMessage, ChatResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface AiCopilotPanelProps {
    isOpen: boolean;
    onClose: () => void;
    activeZoneId?: string;
    onSelectZone?: (zoneId: string) => void;
}

export const AiCopilotPanel: React.FC<AiCopilotPanelProps> = ({
    isOpen,
    onClose,
    activeZoneId = "ZONE-01",
    onSelectZone,
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: "assistant",
            content:
                "**FloodShield AI Grounded Copilot Online.**\nI am equipped with real-time hydrodynamic ML simulations, 108+ historical Indian flood disaster archives, road network inundation models, hospital triage status, and official NDMA operational protocols.\n\nSelect a scenario trigger below or enter a complex query.",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<"civilian" | "commander" | "engineer">("commander");
    const [isExpanded, setIsExpanded] = useState(false);
    const [latestGroundedFacts, setLatestGroundedFacts] = useState<Record<string, any> | null>(null);
    const [latestToolsInvoked, setLatestToolsInvoked] = useState<string[]>([]);
    const [latestSuggestedActions, setLatestSuggestedActions] = useState<string[]>([]);
    const [showToolDrawer, setShowToolDrawer] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, messages]);

    const handleSendMessage = async (customText?: string) => {
        const queryText = (customText || input).trim();
        if (!queryText || isLoading) return;

        const userMsg: ChatMessage = { role: "user", content: queryText };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const history = messages.slice(-4);
            const response: ChatResponse = await chatWithCopilot({
                message: queryText,
                zone_id: activeZoneId,
                user_role: userRole,
                conversation_history: history,
            });

            const assistantMsg: ChatMessage = {
                role: "assistant",
                content: response.reply,
            };

            setMessages((prev) => [...prev, assistantMsg]);
            setLatestGroundedFacts(response.grounded_facts || null);
            setLatestToolsInvoked(response.tools_invoked || []);
            setLatestSuggestedActions(response.suggested_actions || []);

            if (response.referenced_zones && response.referenced_zones.length > 0 && onSelectZone) {
                const zoneRef = response.referenced_zones[0];
                if (zoneRef.includes("ZONE-") || zoneRef.includes("IXE-") || zoneRef.includes("COK-")) {
                    onSelectZone(zoneRef);
                }
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "An error occurred while communicating with the FloodShield AI Engine. Deterministic telemetry offline.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const scenarioPresets = [
        {
            label: "Simulate 3.5m Tide + 120mm Rain",
            prompt: "What if tide is 3.5m and rain is 120mm/h with active cyclone surge?",
            icon: Flame,
        },
        {
            label: "Search 2018 Kerala Flood Archive",
            prompt: "Search historical flood events in Kerala during the 2018 monsoon disaster.",
            icon: History,
        },
        {
            label: "Compare Coastal Risk Matrix",
            prompt: "Compare all coastal zones right now and rank by vulnerability.",
            icon: BarChart3,
        },
        {
            label: "Evacuation Corridors & Road Closures",
            prompt: "What are the submerged roads and safe evacuation lifelines for this zone?",
            icon: Compass,
        },
        {
            label: "Hospital Triage & Safe Shelters",
            prompt: "List all high-ground relief shelters (>10m MSL) and threatened hospital facilities.",
            icon: Shield,
        },
        {
            label: "Generate Multilingual Alert (Kannada)",
            prompt: "Generate an emergency warning SMS in Kannada under 160 characters.",
            icon: Volume2,
        },
    ];

    if (!isOpen) return null;

    return (
        <div
            className={`fixed z-50 transition-all duration-300 flex flex-col bg-slate-950/95 border border-slate-800 backdrop-blur-xl shadow-2xl ${
                isExpanded
                    ? "inset-4 sm:inset-10 rounded-xl"
                    : "bottom-4 right-4 w-[95vw] sm:w-[540px] h-[680px] max-h-[90vh] rounded-xl"
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60 rounded-t-xl">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                        <Bot className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold tracking-wider text-slate-100 uppercase">
                                FloodShield AI Copilot
                            </span>
                            <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px] bg-cyan-950/50 border-cyan-700 text-cyan-300 uppercase tracking-widest font-mono"
                            >
                                Multi-Tool Agent
                            </Badge>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                            Deterministic Hydrodynamic Decision Engine
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {latestToolsInvoked.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowToolDrawer(!showToolDrawer)}
                            className="h-7 px-2 text-[11px] font-mono text-slate-400 hover:text-slate-200 border border-slate-800 bg-slate-900/80"
                        >
                            <Terminal className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                            {latestToolsInvoked.length} Tools
                            {showToolDrawer ? (
                                <ChevronUp className="w-3 h-3 ml-1" />
                            ) : (
                                <ChevronDown className="w-3 h-3 ml-1" />
                            )}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-7 h-7 text-slate-400 hover:text-slate-200"
                    >
                        {isExpanded ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="w-7 h-7 text-slate-400 hover:text-slate-200"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Persona Switcher Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/40 border-b border-slate-800/80 text-xs">
                <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">
                    Persona:
                </span>
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-800 font-mono">
                    <button
                        onClick={() => setUserRole("civilian")}
                        className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                            userRole === "civilian"
                                ? "bg-slate-800 text-slate-100 font-medium"
                                : "text-slate-400 hover:text-slate-300"
                        }`}
                    >
                        Civilian
                    </button>
                    <button
                        onClick={() => setUserRole("commander")}
                        className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                            userRole === "commander"
                                ? "bg-cyan-950 border border-cyan-800/60 text-cyan-300 font-medium"
                                : "text-slate-400 hover:text-slate-300"
                        }`}
                    >
                        Commander
                    </button>
                    <button
                        onClick={() => setUserRole("engineer")}
                        className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                            userRole === "engineer"
                                ? "bg-amber-950 border border-amber-800/60 text-amber-300 font-medium"
                                : "text-slate-400 hover:text-slate-300"
                        }`}
                    >
                        Engineer
                    </button>
                </div>
            </div>

            {/* Tool Drawer (Collapsible) */}
            {showToolDrawer && latestToolsInvoked.length > 0 && (
                <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-cyan-400 font-semibold tracking-wider uppercase">
                            Executed Deterministic Tools
                        </span>
                        <span className="text-[10px] text-slate-500">Live Telemetry Bindings</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {latestToolsInvoked.map((tool, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-cyan-300 font-mono"
                            >
                                + {tool}()
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
                {messages.map((msg, index) => {
                    const isUser = msg.role === "user";
                    return (
                        <div
                            key={index}
                            className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                        >
                            {!isUser && (
                                <div className="flex-shrink-0 w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mt-0.5">
                                    <Bot className="w-3.5 h-3.5" />
                                </div>
                            )}

                            <div
                                className={`relative group max-w-[85%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                                    isUser
                                        ? "bg-cyan-600 text-white font-medium"
                                        : "bg-slate-900 border border-slate-800 text-slate-200"
                                }`}
                            >
                                <div className="whitespace-pre-wrap font-sans text-xs">
                                    {msg.content}
                                </div>

                                {!isUser && (
                                    <button
                                        onClick={() => handleCopy(msg.content, index)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-200 rounded bg-slate-950/60"
                                        title="Copy response"
                                    >
                                        {copiedIndex === index ? (
                                            <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                            <Copy className="w-3 h-3" />
                                        )}
                                    </button>
                                )}
                            </div>

                            {isUser && (
                                <div className="flex-shrink-0 w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 mt-0.5">
                                    <User className="w-3.5 h-3.5" />
                                </div>
                            )}
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-pulse">
                            <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-400 flex items-center gap-2 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            Executing hydrodynamic ML inference & GIS tools...
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Actions (Pills) */}
            {latestSuggestedActions.length > 0 && !isLoading && (
                <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    {latestSuggestedActions.map((action, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSendMessage(action)}
                            className="px-2.5 py-1 rounded text-[11px] font-mono bg-slate-950 hover:bg-slate-900 border border-slate-800 text-cyan-300 transition-colors flex items-center gap-1.5"
                        >
                            <Zap className="w-2.5 h-2.5 text-cyan-400" />
                            {action}
                        </button>
                    ))}
                </div>
            )}

            {/* Scenario Trigger Presets */}
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/80">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1.5">
                    Tactical Query Presets
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-24 overflow-y-auto">
                    {scenarioPresets.map((sc, i) => {
                        const Icon = sc.icon;
                        return (
                            <button
                                key={i}
                                onClick={() => handleSendMessage(sc.prompt)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/60 text-left text-[11px] text-slate-300 hover:text-cyan-300 transition-all font-mono truncate"
                            >
                                <Icon className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                                <span className="truncate">{sc.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Input Form */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/90 rounded-b-xl">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                    }}
                    className="flex items-center gap-2"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Ask Copilot as ${userRole.toUpperCase()} (e.g. "what if tide is 3.5m and rain is 120mm?")`}
                        disabled={isLoading}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors font-sans"
                    />
                    <Button
                        type="submit"
                        size="sm"
                        disabled={!input.trim() || isLoading}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 text-xs font-mono h-8"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </Button>
                </form>
            </div>
        </div>
    );
};
