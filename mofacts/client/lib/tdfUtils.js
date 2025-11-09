/**
 * TDF (Training Definition File) Utilities
 *
 * Pure functions for parsing and manipulating TDF data structures.
 * Extracted from card.js as part of C1.3 refactoring.
 *
 * @module client/lib/tdfUtils
 */

/**
 * Parse a schedule item condition string
 *
 * Converts TDF condition format from "prefix-0" to "prefix_1" (adjusts for 0-based vs 1-based indexing).
 * Returns original string if it doesn't match expected format.
 *
 * @param {string|undefined} cond - Condition string from TDF (e.g., "control-0", "experimental-2")
 * @returns {string} Parsed condition (e.g., "control_1", "experimental_3") or 'UNKNOWN'/'original'
 *
 * @example
 * parseSchedItemCondition('control-0')       // Returns: 'control_1'
 * parseSchedItemCondition('experimental-2')  // Returns: 'experimental_3'
 * parseSchedItemCondition('invalid')         // Returns: 'invalid'
 * parseSchedItemCondition(undefined)         // Returns: 'UNKNOWN'
 */
export function parseSchedItemCondition(cond) {
  if (typeof cond === 'undefined' || !cond) {
    return 'UNKNOWN';
  }

  const fields = _.trim('' + cond).split('-');
  if (fields.length !== 2) {
    return cond;
  }

  const num = parseInt(fields[1]);
  if (isNaN(num)) {
    return cond;
  }

  return fields[0] + '_' + (num + 1).toString();
}
