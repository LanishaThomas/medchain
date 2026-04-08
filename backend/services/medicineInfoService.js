/**
 * Medicine Info Service
 * Resolves any medicine name (brand, generic, regional) to FDA drug data.
 *
 * Pipeline:
 *   1. RxNorm approximate match  → get RxCUI
 *   2. RxNorm RxCUI → related ingredients (resolves brand → generic)
 *   3. OpenFDA label search on resolved generic name
 *   4. Fallback: OpenFDA fuzzy search on original name
 */

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';
const OPENFDA_BASE = 'https://api.fda.gov/drug/label.json';

// Simple fetch with timeout
async function fetchJSON(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Step 1: RxNorm approximate match → RxCUI
 * Handles brand names, misspellings, regional variants
 */
async function resolveRxCUI(name) {
  const encoded = encodeURIComponent(name.trim());
  // approximateTerm is the most forgiving — handles partial names and brand names
  const data = await fetchJSON(`${RXNORM_BASE}/approximateTerm.json?term=${encoded}&maxEntries=5`);
  const candidates = data?.approximateGroup?.candidate || [];
  if (!candidates.length) return null;
  // Return the highest-scored RxCUI
  return candidates[0].rxcui || null;
}

/**
 * Step 2: RxCUI → ingredient name (brand → generic resolution)
 * e.g. "Crocin" RxCUI → "Acetaminophen"
 */
async function resolveIngredientFromRxCUI(rxcui) {
  // Get related concepts at the ingredient level (IN = ingredient)
  const data = await fetchJSON(`${RXNORM_BASE}/rxcui/${rxcui}/related.json?tty=IN`);
  const groups = data?.relatedGroup?.conceptGroup || [];
  for (const group of groups) {
    if (group.tty === 'IN' && group.conceptProperties?.length) {
      return group.conceptProperties[0].name;
    }
  }
  // Fallback: get the name of the RxCUI itself
  const nameData = await fetchJSON(`${RXNORM_BASE}/rxcui/${rxcui}/property.json?propName=RxNorm%20Name`);
  return nameData?.propConceptGroup?.propConcept?.[0]?.propValue || null;
}

/**
 * Step 3: Query OpenFDA with a drug name
 * Tries brand_name, generic_name, and substance_name fields
 */
async function queryOpenFDA(name) {
  const encoded = encodeURIComponent(`"${name}"`);
  const fields = ['openfda.brand_name', 'openfda.generic_name', 'openfda.substance_name'];

  for (const field of fields) {
    const url = `${OPENFDA_BASE}?search=${field}:${encoded}&limit=1`;
    const data = await fetchJSON(url);
    if (data?.results?.length) return data.results[0];
  }
  return null;
}

/**
 * Step 4: OpenFDA fuzzy search — last resort
 */
async function queryOpenFDAFuzzy(name) {
  const encoded = encodeURIComponent(name.trim());
  const url = `${OPENFDA_BASE}?search=${encoded}&limit=1`;
  const data = await fetchJSON(url);
  return data?.results?.[0] || null;
}

/**
 * Extract clean, patient-friendly fields from an OpenFDA label result
 */
function extractDrugInfo(result, resolvedName, originalName) {
  const pick = (arr) => (Array.isArray(arr) ? arr[0] : null);

  // Clean up FDA label text — strip XML-like tags and excessive whitespace
  const clean = (text) => {
    if (!text) return null;
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 800); // cap length for UI
  };

  const openfda = result.openfda || {};

  return {
    resolvedName: resolvedName || originalName,
    brandNames: openfda.brand_name || [],
    genericName: pick(openfda.generic_name) || resolvedName || originalName,
    manufacturer: pick(openfda.manufacturer_name) || null,
    drugClass: openfda.pharm_class_epc || openfda.pharm_class_cs || [],
    indicationsAndUsage: clean(pick(result.indications_and_usage)),
    mechanismOfAction: clean(pick(result.mechanism_of_action)),
    adverseReactions: clean(pick(result.adverse_reactions)),
    warnings: clean(pick(result.warnings) || pick(result.warnings_and_cautions)),
    contraindications: clean(pick(result.contraindications)),
    dosageAndAdministration: clean(pick(result.dosage_and_administration)),
    howSupplied: clean(pick(result.how_supplied)),
    source: 'OpenFDA (U.S. National Library of Medicine)',
  };
}

/**
 * Main entry point
 * @param {string} medicineName - any name the doctor typed
 * @returns {object} structured drug info or null
 */
async function getMedicineInfo(medicineName) {
  const original = medicineName.trim();
  let resolvedName = original;
  let fdaResult = null;

  // Step 1 + 2: RxNorm resolution
  try {
    const rxcui = await resolveRxCUI(original);
    if (rxcui) {
      const ingredient = await resolveIngredientFromRxCUI(rxcui);
      if (ingredient) resolvedName = ingredient;
    }
  } catch {
    // RxNorm failed — continue with original name
  }

  // Step 3: OpenFDA with resolved name
  fdaResult = await queryOpenFDA(resolvedName);

  // Step 4: If resolved name didn't work, try original
  if (!fdaResult && resolvedName !== original) {
    fdaResult = await queryOpenFDA(original);
  }

  // Step 5: Fuzzy fallback
  if (!fdaResult) {
    fdaResult = await queryOpenFDAFuzzy(original);
  }

  if (!fdaResult) return null;

  return extractDrugInfo(fdaResult, resolvedName, original);
}

module.exports = { getMedicineInfo };
