import logging
import sys
from typing import List, Dict, Any

# ANSI Color Codes (works seamlessly in Windows Terminal and PowerShell)
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"

# Foreground Colors
CYAN = "\033[36m"
BLUE = "\033[34m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
WHITE = "\033[37m"

# Background Colors
BG_RED = "\033[41m"
BG_YELLOW = "\033[43m"
BG_BLUE = "\033[44m"


def get_threat_badge(threat_level: str) -> str:
    tl = str(threat_level).upper().replace("THREATLEVEL.", "")
    if tl == "CRITICAL":
        return f"{BG_RED}{WHITE}{BOLD} CRITICAL {RESET}"
    elif tl == "HIGH":
        return f"{RED}{BOLD}[HIGH]{RESET}"
    elif tl == "MODERATE":
        return f"{YELLOW}{BOLD}[MODERATE]{RESET}"
    elif tl == "LOW":
        return f"{GREEN}{BOLD}[LOW]{RESET}"
    return f"{CYAN}[{tl}]{RESET}"


class FloodShieldLogger:
    def __init__(self, name: str = "FloodShieldAI"):
        self.logger = logging.getLogger(name)
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            formatter = logging.Formatter(
                f"{DIM}%(asctime)s{RESET} | %(message)s",
                datefmt="%H:%M:%S"
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def log_request_start(self, method: str, path: str, client_ip: str):
        print(f"\n{CYAN}{'='*78}{RESET}")
        print(f"{CYAN}{BOLD}>> INCOMING API REQUEST:{RESET} {WHITE}{BOLD}{method} {path}{RESET} {DIM}(Client: {client_ip}){RESET}")

    def log_request_end(self, method: str, path: str, status_code: int, duration_ms: float):
        status_color = GREEN if status_code < 400 else (YELLOW if status_code < 500 else RED)
        status_str = f"{status_color}{BOLD}{status_code} OK{RESET}" if status_code == 200 else f"{status_color}{BOLD}{status_code}{RESET}"
        print(f"{status_color}[API RESPONSE]{RESET} {WHITE}{method} {path}{RESET} -> {status_str} in {BOLD}{duration_ms:.1f}ms{RESET}")
        print(f"{CYAN}{'='*78}{RESET}\n")

    def log_simulation_run(
        self,
        tide: float,
        rainfall: float,
        forecast_hours: int,
        cyclone: bool,
        soil_saturation: float,
        overall_threat: str,
        pop_at_risk: int,
        inundated_area: float,
        zones_summary: List[Dict[str, Any]],
        exec_time_ms: float,
    ):
        print(f"{WHITE}{BOLD}+-- AI SIMULATION ENGINE PIPELINE --------------------------------------------{RESET}")
        print(
            f"{WHITE}|  {BOLD}INPUTS:{RESET} Tide: {CYAN}{tide:.2f}m{RESET} | "
            f"Rainfall: {CYAN}{rainfall:.1f}mm/h{RESET} | "
            f"Forecast: {CYAN}{forecast_hours}h{RESET} | "
            f"Cyclone: {MAGENTA if cyclone else DIM}{'ACTIVE' if cyclone else 'INACTIVE'}{RESET} | "
            f"Soil Saturation: {CYAN}{soil_saturation*100:.0f}%{RESET}"
        )
        print(
            f"{WHITE}|  {BOLD}IMPACT:{RESET} Threat: {get_threat_badge(overall_threat)} | "
            f"Pop at Risk: {YELLOW}{BOLD}{pop_at_risk:,}{RESET} | "
            f"Inundation: {YELLOW}{BOLD}{inundated_area:.2f} sq km{RESET} | "
            f"Inference: {GREEN}{exec_time_ms:.1f}ms{RESET}"
        )
        print(f"{WHITE}|  {BOLD}ZONE BREAKDOWN:{RESET}")
        
        for z in zones_summary:
            z_name = z.get("zone_name", "Unknown")
            z_threat = z.get("threat_level", "LOW")
            z_depth = z.get("water_depth", 0.0)
            z_onset = z.get("onset_time", 0)
            z_peak = z.get("peak_time", 0)
            z_driver = z.get("top_driver", "N/A")
            z_pct = z.get("top_driver_pct", 0)
            
            badge = get_threat_badge(str(z_threat))
            print(
                f"{WHITE}|    * {BOLD}{z_name:<24}{RESET} {badge} "
                f"Depth: {CYAN}{z_depth:.2f}m{RESET} | "
                f"Onset: {YELLOW}{z_onset}m{RESET} / Peak: {YELLOW}{z_peak}m{RESET} | "
                f"Top Driver: {MAGENTA}{z_driver} ({z_pct}%){RESET}"
            )
        print(f"{WHITE}+-----------------------------------------------------------------------------{RESET}")

    def log_sitrep(
        self,
        headline: str,
        overall_threat: str,
        pop_at_risk: int,
        affected_roads_count: int,
        threatened_facilities_count: int,
        directives_count: int,
    ):
        print(f"{WHITE}{BOLD}+-- NDRF SITREP GENERATION ---------------------------------------------------{RESET}")
        print(f"{WHITE}|  {BOLD}HEADLINE:{RESET} {YELLOW}{BOLD}{headline}{RESET}")
        print(
            f"{WHITE}|  {BOLD}SUMMARY:{RESET}  Threat: {get_threat_badge(overall_threat)} | "
            f"Population: {YELLOW}{BOLD}{pop_at_risk:,}{RESET} | "
            f"Hospitals: {RED}{threatened_facilities_count}{RESET} | "
            f"Submerged Roads: {RED}{affected_roads_count}{RESET} | "
            f"Tactical Directives: {GREEN}{directives_count}{RESET}"
        )
        print(f"{WHITE}+-----------------------------------------------------------------------------{RESET}")

    def log_decision_queue(self, priority_count: int, top_zone: str, top_action: str):
        print(f"{WHITE}{BOLD}+-- JUVE DECISION FRAMEWORK --------------------------------------------------{RESET}")
        print(f"{WHITE}|  {BOLD}QUEUED ZONES:{RESET} {CYAN}{priority_count} operational sectors prioritized{RESET}")
        print(f"{WHITE}|  {BOLD}PRIORITY 1:{RESET}   {BOLD}{top_zone}{RESET} -> {YELLOW}{top_action}{RESET}")
        print(f"{WHITE}+-----------------------------------------------------------------------------{RESET}")


logger = FloodShieldLogger()
