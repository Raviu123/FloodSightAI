import { Language, LanguageOption, TranslationSchema } from "./types";
import { en } from "./en";
import { hi } from "./hi";
import { kn } from "./kn";
import { ja } from "./ja";
import type { SITREPReport, SimulationResponse } from "@/types";

export * from "./types";

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
];

export const translations: Record<Language, TranslationSchema> = {
  en,
  hi,
  kn,
  ja,
};

export const DEFAULT_LANGUAGE: Language = "en";

export function getTranslation(lang: Language): TranslationSchema {
  return translations[lang] || translations[DEFAULT_LANGUAGE];
}

export function formatSitrep(
  sitrep: SITREPReport | null,
  simulationData: SimulationResponse | null,
  t: TranslationSchema
): { executiveSummary: string; directives: string[] } {
  const isCritical =
    (simulationData && (simulationData.critical_zones_count > 0 || simulationData.overall_risk === "CRITICAL" || simulationData.overall_risk === "HIGH")) ||
    (sitrep && sitrep.impact_assessment && sitrep.impact_assessment.critical_zones_count > 0);

  const topZone = simulationData?.zones?.[0];
  const count = simulationData?.critical_zones_count || sitrep?.impact_assessment?.critical_zones_count || 1;
  const zoneName = topZone?.zone_name || "Mangalore Estuary Sector 4";
  const depth = topZone?.projected_depth_meters ?? 1.5;
  const onset = topZone?.onset_time_minutes ?? 25;

  if (isCritical) {
    const summary = t.sitrep.criticalSummary
      .replace("{count}", String(count))
      .replace("{zone}", zoneName)
      .replace("{depth}", String(depth))
      .replace("{onset}", String(onset));

    const directives = [
      t.sitrep.directiveDeployTeams.replace("{zone}", zoneName),
      t.sitrep.directivePumps,
      t.sitrep.directiveSms,
    ];

    return { executiveSummary: summary, directives };
  }

  return {
    executiveSummary: t.sitrep.stableSummary,
    directives: [t.sitrep.directivePolling, t.sitrep.directiveStandby],
  };
}
