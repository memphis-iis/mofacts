/**
 * String Utilities
 *
 * Pure functions for string manipulation and validation.
 * Extracted from card.js as part of C1.3 refactoring.
 *
 * @module client/lib/stringUtils
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * Security: Allows safe formatting tags but blocks scripts, iframes, and event handlers
 *
 * @param {string} dirty - Unsanitized HTML string
 * @returns {string} Sanitized HTML safe for rendering
 *
 * @example
 * sanitizeHTML('<p>Safe text</p><script>alert("XSS")</script>')
 * // Returns: '<p>Safe text</p>'
 */
export function sanitizeHTML(dirty) {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div',
                   'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'table', 'tr', 'td', 'th', 'thead', 'tbody',
                   'ul', 'ol', 'li', 'center', 'a', 'img', 'audio', 'source'],
    ALLOWED_ATTR: ['style', 'class', 'id', 'border', 'href', 'src', 'alt', 'width', 'height', 'controls', 'preload', 'data-audio-id'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  });
}

/**
 * Get the next ASCII character
 *
 * @param {string} c - Single character
 * @returns {string} Next character in ASCII sequence
 *
 * @example
 * nextChar('a') // Returns: 'b'
 * nextChar('A') // Returns: 'B'
 */
export function nextChar(c) {
  return String.fromCharCode(c.charCodeAt(0) + 1);
}

/**
 * Calculate Levenshtein distance (edit distance) between two strings
 *
 * Used for fuzzy string matching in speech recognition and answer validation.
 * Measures minimum number of single-character edits (insertions, deletions, substitutions)
 * needed to change one word into another.
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance (0 = identical strings)
 *
 * @example
 * levenshteinDistance('kitten', 'sitting') // Returns: 3
 * levenshteinDistance('hello', 'hello')    // Returns: 0
 */
export function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
