/**
 * Phonetic Matching Utilities
 *
 * Functions for phonetic matching using Double Metaphone algorithm.
 * Used primarily for speech recognition to fuzzy-match spoken words to correct answers.
 * Extracted from card.js as part of C1.3 refactoring.
 *
 * @module client/lib/phoneticUtils
 */

import { doubleMetaphone } from 'double-metaphone';
import { levenshteinDistance } from './stringUtils';
import { clientConsole } from '../index';

// Module-level cache for phonetic codes to avoid redundant computation
const phoneticCache = new Map();

/**
 * Get phonetic codes for a word using Double Metaphone
 *
 * Returns [primary, secondary] phonetic codes. Uses module-level cache for performance.
 *
 * @param {string} word - Word to get phonetic codes for
 * @returns {string[]} Array of [primary, secondary] phonetic codes
 *
 * @example
 * getPhoneticCodes('mali')      // Returns: ['ML', '']
 * getPhoneticCodes('cameron')   // Returns: ['KMRN', '']
 */
export function getPhoneticCodes(word) {
  const normalizedWord = word.toLowerCase().trim();

  // Check cache first
  if (phoneticCache.has(normalizedWord)) {
    return phoneticCache.get(normalizedWord);
  }

  // Compute and cache
  const codes = doubleMetaphone(normalizedWord);
  phoneticCache.set(normalizedWord, codes);
  return codes; // [primary, secondary]
}

/**
 * Pre-compute phonetic index for O(1) lookup instead of O(n) search
 *
 * Creates a Map from phonetic codes to word entries for fast lookup.
 *
 * @param {string[]} grammarList - List of words to index
 * @returns {Map<string, Array>} Map of phonetic code → [{word, length, primary, secondary}]
 *
 * @example
 * const index = buildPhoneticIndex(['mali', 'malawi', 'peru']);
 * // index.get('ML') → [{word: 'mali', length: 4, primary: 'ML', secondary: ''}]
 */
export function buildPhoneticIndex(grammarList) {
  const index = new Map();
  const startTime = performance.now();

  for (const word of grammarList) {
    // Use cached phonetic codes
    const [primary, secondary] = getPhoneticCodes(word);
    const entry = {
      word: word,
      length: word.length,
      primary: primary,
      secondary: secondary
    };

    // Index by primary code
    if (primary) {
      if (!index.has(primary)) {
        index.set(primary, []);
      }
      index.get(primary).push(entry);
    }

    // Index by secondary code
    if (secondary && secondary !== primary) {
      if (!index.has(secondary)) {
        index.set(secondary, []);
      }
      index.get(secondary).push(entry);
    }
  }

  const elapsed = performance.now() - startTime;
  clientConsole(2, `[SR] 📇 Built phonetic index: ${grammarList.length} words → ${index.size} codes in ${elapsed.toFixed(2)}ms`);
  return index;
}

/**
 * Find words in grammar that have phonetic conflicts with the correct answer
 *
 * These should be removed from phrase hints and answer grammar to prevent false matches.
 * Uses SAME matching logic as Tier 2 (exact) and Tier 3 (fuzzy) phonetic matching.
 *
 * @param {string} correctAnswer - The correct answer to check against
 * @param {string[]} grammarList - List of words to search for conflicts
 * @param {Map} [phoneticIndex=null] - Optional pre-computed phonetic index
 * @returns {string[]} Array of conflicting words
 *
 * @example
 * findPhoneticConflictsWithCorrectAnswer('anguilla', ['angola', 'peru'])
 * // Returns: ['angola']  (ANKL = ANKL, exact match)
 */
export function findPhoneticConflictsWithCorrectAnswer(correctAnswer, grammarList, phoneticIndex = null) {
  const conflicts = [];

  // Get phonetic codes for the correct answer
  const [correctPrimary, correctSecondary] = getPhoneticCodes(correctAnswer);

  // Search through grammar with SAME logic as Tier 2 + Tier 3
  for (const word of grammarList) {
    if (word === correctAnswer) continue; // Skip the correct answer itself

    const [wordPrimary, wordSecondary] = getPhoneticCodes(word);

    // Tier 2: Check if ANY codes match exactly (primary-to-primary, primary-to-secondary, etc.)
    const exactMatch =
      (correctPrimary && (correctPrimary === wordPrimary || correctPrimary === wordSecondary)) ||
      (correctSecondary && (correctSecondary === wordPrimary || correctSecondary === wordSecondary));

    if (exactMatch) {
      conflicts.push(word);
      continue;
    }

    // Fuzzy phonetic matching - edit distance = 1 on phonetic codes
    // No minimum code length constraint - works for all countries including short ones like "mali" (ML)
    const phoneticEditDist = Math.min(
      levenshteinDistance(correctPrimary, wordPrimary),
      correctSecondary ? levenshteinDistance(correctSecondary, wordPrimary) : Infinity,
      wordSecondary ? levenshteinDistance(correctPrimary, wordSecondary) : Infinity,
      (correctSecondary && wordSecondary) ? levenshteinDistance(correctSecondary, wordSecondary) : Infinity
    );

    // If phonetic codes are within edit distance of 1, it's a conflict
    if (phoneticEditDist === 1) {
      conflicts.push(word);
    }
  }

  if (conflicts.length > 0) {
    clientConsole(2, `[SR] 🚫 Found ${conflicts.length} phonetic conflict(s) with "${correctAnswer}": [${conflicts.join(', ')}]`);
  }

  return conflicts;
}

/**
 * Filter out phonetically ambiguous words from grammar
 *
 * For example, if spoken word is "molly", exclude "malawi" from candidates since it
 * phonetically matches "mali" which is closer in length to "molly".
 *
 * @param {string} spokenWord - The word that was spoken
 * @param {string[]} grammarList - List of candidate words
 * @returns {string[]} Filtered grammar list
 *
 * @example
 * filterPhoneticConflicts('molly', ['mali', 'malawi', 'peru'])
 * // Returns: ['mali', 'peru']  (malawi removed due to conflict with mali)
 */
export function filterPhoneticConflicts(spokenWord, grammarList) {
  // Use cached phonetic codes
  const [spokenPrimary, spokenSecondary] = getPhoneticCodes(spokenWord);
  const spokenLength = spokenWord.length;

  // Build a map of phonetic codes to words with their lengths
  const phoneticGroups = new Map();

  for (const word of grammarList) {
    // Use cached phonetic codes
    const [primary, secondary] = getPhoneticCodes(word);
    const codes = [primary];
    if (secondary && secondary !== primary) {
      codes.push(secondary);
    }

    for (const code of codes) {
      if (!phoneticGroups.has(code)) {
        phoneticGroups.set(code, []);
      }
      phoneticGroups.get(code).push({ word, length: word.length });
    }
  }

  // Find all words that share phonetic codes with spoken word
  const relevantCodes = [spokenPrimary];
  if (spokenSecondary && spokenSecondary !== spokenPrimary) {
    relevantCodes.push(spokenSecondary);
  }

  let conflicts = [];
  for (const code of relevantCodes) {
    if (phoneticGroups.has(code)) {
      conflicts.push(...phoneticGroups.get(code));
    }
  }

  if (conflicts.length <= 1) {
    // No conflicts, return original list
    return grammarList;
  }

  // Sort conflicts by length difference from spoken word (closest first)
  conflicts.sort((a, b) => {
    const diffA = Math.abs(a.length - spokenLength);
    const diffB = Math.abs(b.length - spokenLength);
    return diffA - diffB;
  });

  // Keep ONLY the words with the exact closest length match
  // If "molly"(5) has conflicts with "mali"(4, diff=1) and "malawi"(6, diff=1),
  // we need a tie-breaker: prefer SHORTER words (homophones are usually not longer)
  const closestDiff = Math.abs(conflicts[0].length - spokenLength);
  const closestMatches = conflicts.filter(c => Math.abs(c.length - spokenLength) === closestDiff);

  // Tie-breaker: prefer shorter words when multiple have same length diff
  const preferShorter = closestMatches.filter(c => c.length <= spokenLength);
  const finalCandidates = preferShorter.length > 0 ? preferShorter : closestMatches;

  const keepWords = new Set(
    finalCandidates
      .slice(0, 2) // Keep at most 2 to avoid ambiguity
      .map(c => c.word)
  );

  const filtered = grammarList.filter(word => {
    const shouldKeep = !conflicts.some(c => c.word === word) || keepWords.has(word);
    return shouldKeep;
  });

  return filtered;
}

/**
 * Find phonetically matching word from grammar list using Double Metaphone
 *
 * Two-tier matching: Tier 1 (exact string) + Tier 2 (exact phonetic code).
 * Fuzzy phonetic conflicts are filtered out BEFORE calling this function.
 *
 * @param {string} spokenWord - The word that was spoken
 * @param {string[]} grammarList - List of candidate words
 * @param {Map} [phoneticIndex=null] - Optional pre-computed phonetic index for O(1) lookup
 * @returns {string|null} Best matching word or null if no match found
 *
 * @example
 * findPhoneticMatch('molly', ['mali', 'peru'], index)
 * // Returns: 'mali' (phonetic match)
 */
export function findPhoneticMatch(spokenWord, grammarList, phoneticIndex = null) {
  // First, filter out phonetically conflicting words (e.g., "malawi" when looking for "mali")
  const filteredGrammar = filterPhoneticConflicts(spokenWord, grammarList);

  // Rebuild index if we filtered the grammar
  if (phoneticIndex && filteredGrammar.length < grammarList.length) {
    phoneticIndex = buildPhoneticIndex(filteredGrammar);
  }

  // Try with original spoken word
  const result = tryPhoneticMatch(spokenWord, filteredGrammar, phoneticIndex);
  if (result) {
    return result;
  }

  // If spoken word has spaces, also try without spaces (handles "care about" → "kiribati")
  if (spokenWord.includes(' ')) {
    const noSpaces = spokenWord.replace(/\s+/g, '');
    clientConsole(2, `[SR] Retrying phonetic match without spaces: "${noSpaces}"`);
    return tryPhoneticMatch(noSpaces, filteredGrammar, phoneticIndex);
  }

  return null;
}

/**
 * Internal helper for phonetic matching
 *
 * Implements tier-based matching logic:
 * - Tier 2: Exact phonetic code match
 * - Tier 3: Fuzzy phonetic match (edit distance = 1)
 *
 * @param {string} spokenWord - The word that was spoken
 * @param {string[]} grammarList - List of candidate words
 * @param {Map} [phoneticIndex=null] - Optional pre-computed phonetic index
 * @returns {string|null} Best matching word or null
 *
 * @private
 */
export function tryPhoneticMatch(spokenWord, grammarList, phoneticIndex = null) {
  const [spokenPrimary, spokenSecondary] = getPhoneticCodes(spokenWord);

  clientConsole(2, `[SR] Looking for phonetic match for "${spokenWord}"...`);

  // Additional validation: words must be similar in length to avoid false matches
  // (e.g., "mali" shouldn't match "malawi", "akrotiri" shouldn't match "ecuador")
  const spokenLength = spokenWord.length;

  let bestMatch = null;
  let bestMatchScore = Infinity;

  // Use phonetic index for O(1) lookup if available
  let candidateEntries = [];
  if (phoneticIndex) {
    clientConsole(2, `[SR] Using pre-computed phonetic index (O(1) lookup)`);
    // Get all words that match the spoken phonetic codes EXACTLY
    const primaryMatches = phoneticIndex.get(spokenPrimary) || [];
    const secondaryMatches = spokenSecondary ? (phoneticIndex.get(spokenSecondary) || []) : [];
    candidateEntries = [...primaryMatches, ...secondaryMatches];

    clientConsole(2, `[SR] Found ${candidateEntries.length} candidate entries from phonetic index`);
  } else {
    // Fallback: convert grammarList to entries format for O(n) search
    clientConsole(2, `[SR] No phonetic index, using O(n) search`);
    candidateEntries = grammarList.map(word => ({
      word: word,
      length: word.length,
      primary: null, // Will compute lazily
      secondary: null
    }));
  }

  // Process candidates
  for (const entry of candidateEntries) {
    const grammarWord = entry.word;
    const grammarLength = entry.length;

    // Smart length guard: use BOTH absolute and proportional checks
    // This prevents "mali" (4) → "malawi" (6) while allowing near-homophones
    // "mali"(4) vs "malawi"(6): diff=2, proportion=2/4=50% → REJECTED
    // "peru"(4) vs "perdue"(6): diff=2, proportion=2/4=50% → REJECTED (needs phonetic match)
    const lengthDiff = Math.abs(spokenLength - grammarLength);
    const maxAbsoluteDiff = 2; // Max 2 character difference (stricter)
    const maxProportionalDiff = 0.30; // Max 30% length difference based on SHORTER word

    const shorterLength = Math.min(spokenLength, grammarLength);
    const proportionalDiff = lengthDiff / shorterLength;

    // Reject if EITHER condition fails
    if (lengthDiff > maxAbsoluteDiff || proportionalDiff > maxProportionalDiff) {
      continue;
    }

    // Get or compute phonetic codes
    let grammarPrimary, grammarSecondary;
    if (entry.primary !== null) {
      // Already computed in index
      grammarPrimary = entry.primary;
      grammarSecondary = entry.secondary;
    } else {
      // Compute on demand for O(n) fallback
      [grammarPrimary, grammarSecondary] = getPhoneticCodes(grammarWord);
    }

    // Check for exact phonetic code match
    const exactPhoneticMatch = spokenPrimary === grammarPrimary ||
        (spokenSecondary && spokenSecondary === grammarPrimary) ||
        (grammarSecondary && spokenPrimary === grammarSecondary) ||
        (spokenSecondary && grammarSecondary && spokenSecondary === grammarSecondary);

    if (exactPhoneticMatch) {
      // Exact phonetic match - prefer shorter length difference
      if (lengthDiff < bestMatchScore) {
        bestMatch = grammarWord;
        bestMatchScore = lengthDiff;
      }
      // If length diff is 0 or 1, accept immediately (perfect homophones)
      if (lengthDiff <= 1) {
        return grammarWord;
      }
    } else {
      // Tier 3: Fuzzy phonetic matching - edit distance = 1 on PHONETIC CODES
      // This checks if the phonetic codes are similar, not the literal words
      // Pre-filtering is just a bias, so we still need this as backup
      const phoneticEditDist = Math.min(
        levenshteinDistance(spokenPrimary, grammarPrimary),
        spokenSecondary ? levenshteinDistance(spokenSecondary, grammarPrimary) : Infinity,
        grammarSecondary ? levenshteinDistance(spokenPrimary, grammarSecondary) : Infinity,
        (spokenSecondary && grammarSecondary) ? levenshteinDistance(spokenSecondary, grammarSecondary) : Infinity
      );

      // Allow fuzzy match if phonetic codes differ by exactly 1 character
      // No minimum code length restriction - works for all countries
      if (phoneticEditDist === 1) {
        const fuzzyScore = phoneticEditDist * 10 + lengthDiff;
        if (fuzzyScore < bestMatchScore) {
          bestMatch = grammarWord;
          bestMatchScore = fuzzyScore;
        }
      }
    }
  }

  if (bestMatch) {
    clientConsole(2, `[SR] ✅ Best phonetic match: "${spokenWord}" → "${bestMatch}"`);
    return bestMatch;
  }

  clientConsole(2, `[SR] No phonetic match found`);
  return null;
}
