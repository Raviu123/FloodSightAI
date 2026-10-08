import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, getTranslation, translations, formatSitrep, Language } from "../src/locales";

async function runTests() {
  console.log("=== Running i18n & Localization Verification Suite ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Test 1: Available Languages
  assert(AVAILABLE_LANGUAGES.length === 4, "Should have exactly 4 supported languages");
  const codes = AVAILABLE_LANGUAGES.map((l) => l.code);
  assert(codes.includes("en") && codes.includes("hi") && codes.includes("kn") && codes.includes("ja"), "Should support en, hi, kn, ja");
  assert(DEFAULT_LANGUAGE === "en", "Default language should be 'en'");

  // Test 2: Locale Dictionary Parity
  const languages: Language[] = ["en", "hi", "kn", "ja"];

  function checkNestedKeys(baseObj: any, compareObj: any, path = ""): string[] {
    let missing: string[] = [];
    for (const key of Object.keys(baseObj)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (!(key in compareObj)) {
        missing.push(currentPath);
      } else if (typeof baseObj[key] === "object" && baseObj[key] !== null) {
        missing = missing.concat(checkNestedKeys(baseObj[key], compareObj[key], currentPath));
      } else if (typeof compareObj[key] !== "string" || compareObj[key].trim().length === 0) {
        missing.push(`${currentPath} (empty or invalid string)`);
      }
    }
    return missing;
  }

  const enDict = translations.en;
  for (const lang of languages) {
    const dict = translations[lang];
    assert(!!dict, `Dictionary exists for language '${lang}'`);
    const missingKeys = checkNestedKeys(enDict, dict);
    assert(missingKeys.length === 0, `Language '${lang}' has 100% key parity with English (${missingKeys.length} missing)`);
    if (missingKeys.length > 0) {
      console.error(`    Missing in ${lang}:`, missingKeys.slice(0, 5));
    }
  }

  // Test 3: Language Resolver and Fallback
  assert(getTranslation("en").common.systemTitle === "FloodShield AI", "English resolution works");
  assert(getTranslation("hi").common.systemTitle === "फ्लडशील्ड एआई", "Hindi resolution works");
  assert(getTranslation("kn").common.systemTitle === "ಫ್ಲಡ್‌ಶೀಲ್ಡ್ AI", "Kannada resolution works");
  assert(getTranslation("ja").common.systemTitle === "FloodShield AI", "Japanese resolution works");
  assert(getTranslation("fr" as any).common.systemTitle === "FloodShield AI", "Invalid language falls back to English");

  // Test 4: Script Validation
  assert(translations.hi.home.headline.includes("तटीय"), "Hindi contains valid Devanagari characters");
  assert(translations.kn.home.headline.includes("ಕರಾವಳಿ"), "Kannada contains valid Kannada script characters");
  assert(translations.ja.home.headline.includes("沿岸"), "Japanese contains valid Kanji/Kana characters");

  // Test 5: SITREP Formatter Localized Generation
  const dummySim: any = {
    critical_zones_count: 2,
    overall_risk: "CRITICAL",
    zones: [{ zone_name: "Mangalore Sector 4", projected_depth_meters: 1.8, onset_time_minutes: 20 }],
  };
  const hiSitrep = formatSitrep(null, dummySim, translations.hi);
  assert(hiSitrep.executiveSummary.includes("तटीय"), "SITREP executive summary format in Hindi works");
  assert(hiSitrep.directives[0].includes("एनडीआरएफ"), "SITREP tactical directives format in Hindi works");
  const knSitrep = formatSitrep(null, dummySim, translations.kn);
  assert(knSitrep.executiveSummary.includes("ಕರಾವಳಿ"), "SITREP executive summary format in Kannada works");
  const jaSitrep = formatSitrep(null, dummySim, translations.ja);
  assert(jaSitrep.executiveSummary.includes("高潮"), "SITREP executive summary format in Japanese works");

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
