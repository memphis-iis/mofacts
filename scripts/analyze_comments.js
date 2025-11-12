#!/usr/bin/env node
/**
 * Analyze multi-line comment blocks in card.js and generate compression mapping.
 */

const fs = require('fs');
const path = require('path');

function analyzeCommentBlocks(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');

  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trimStart();

    if (stripped.startsWith('//')) {
      const commentText = stripped.substring(2).trim();

      if (currentBlock === null) {
        // Start new block
        currentBlock = {
          startLine: i + 1,
          endLine: i + 1,
          lines: [commentText]
        };
      } else {
        // Continue block
        currentBlock.endLine = i + 1;
        currentBlock.lines.push(commentText);
      }
    } else {
      // Non-comment line - finish current block if it exists
      if (currentBlock !== null) {
        // Only keep blocks with 2+ lines
        if (currentBlock.lines.length >= 2) {
          blocks.push(currentBlock);
        }
        currentBlock = null;
      }
    }
  }

  // Handle case where file ends with a comment block
  if (currentBlock !== null && currentBlock.lines.length >= 2) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function compressBlock(block) {
  const lines = block.lines;
  const fullText = lines.join(' ');

  // Pattern-based semantic compression
  const patterns = [
    // Phase/Section markers
    { pattern: /={3,}.*PHASE.*={3,}/i, fn: () => {
      const match = fullText.match(/PHASE[^=]*/i);
      return '// ' + (match ? match[0].trim() : lines[0]);
    }},
    { pattern: /={3,}/, fn: () => '// ' + lines[0] },
    { pattern: /\/{3,}/, fn: () => '// ' + lines[0] },

    // State machine
    { pattern: /STATE MACHINE/i, fn: () => '// STATE MACHINE: ' + (lines[1] || lines[0]) },
    { pattern: /TRANSITION/i, fn: () => '// State transition: ' + fullText.substring(0, 80) },

    // Fix/Bug
    { pattern: /\b(FIX|FIXED|BUG):/i, fn: () => {
      return '// FIX: ' + fullText.substring(0, 100).replace(/FIX:|FIXED:|BUG:/gi, '').trim();
    }},

    // Performance
    { pattern: /\b(PERFORMANCE|OPTIMIZATION)\b/i, fn: () => '// PERF: ' + fullText.substring(0, 100) },

    // Security
    { pattern: /\b(SECURITY|XSS|SANITIZE)\b/i, fn: () => '// SECURITY: ' + fullText.substring(0, 100) },

    // Defensive/Critical
    { pattern: /\b(CRITICAL|DEFENSIVE|IMPORTANT):/i, fn: () => '// ' + fullText.substring(0, 120) },

    // Accessibility
    { pattern: /\b(ACCESSIBILITY|ARIA|screen reader)\b/i, fn: () => '// A11Y: ' + fullText.substring(0, 100) },

    // MO/M3 markers
    { pattern: /\b(M3|MO\d+):/i, fn: () => '// ' + fullText.substring(0, 120) },

    // TODO/NOTE/WARNING
    { pattern: /\b(TODO|NOTE|WARNING):/i, fn: () => '// ' + fullText.substring(0, 100) },

    // Helper function
    { pattern: /Helper function/i, fn: () => '// Helper: ' + fullText.substring(0, 80) },

    // Scenario
    { pattern: /Scenario \d+/i, fn: () => '// ' + fullText.substring(0, 100) },
  ];

  // Try pattern matching
  for (const {pattern, fn} of patterns) {
    if (pattern.test(fullText)) {
      return fn();
    }
  }

  // Default compression strategies

  // Check if explaining purpose
  const purposeKeywords = ['this ', 'we ', 'note that', 'function', 'called'];
  if (purposeKeywords.some(kw => fullText.toLowerCase().includes(kw))) {
    if (fullText.length <= 120) {
      return '// ' + fullText;
    } else {
      const sentences = fullText.split(/[.!?]\s+/);
      if (sentences.length > 0) {
        return '// ' + sentences[0].substring(0, 120);
      }
    }
  }

  // Configuration
  const configKeywords = ['setting', 'config', 'option', 'parameter'];
  if (configKeywords.some(kw => fullText.toLowerCase().includes(kw))) {
    return '// Config: ' + fullText.substring(0, 100);
  }

  // Logic flow
  const logicKeywords = ['if ', 'when ', 'check ', 'handle'];
  if (logicKeywords.some(kw => fullText.toLowerCase().includes(kw))) {
    return '// Logic: ' + fullText.substring(0, 100);
  }

  // Default
  if (lines[0].length <= 100) {
    return '// ' + lines[0];
  } else {
    return '// ' + fullText.substring(0, 120);
  }
}

function main() {
  const filepath = path.join(__dirname, 'mofacts', 'client', 'views', 'experiment', 'card.js');

  console.log('Analyzing comment blocks in card.js...');
  const blocks = analyzeCommentBlocks(filepath);

  console.log(`Found ${blocks.length} multi-line comment blocks (2+ consecutive lines)`);

  // Generate compression mapping
  const result = blocks.map((block, i) => {
    const preview = block.lines.slice(0, 2).join(' ');
    return {
      blockNum: i + 1,
      startLine: block.startLine,
      endLine: block.endLine,
      lineCount: block.lines.length,
      preview: preview.substring(0, 100) + (preview.length > 100 ? '...' : ''),
      compressed: compressBlock(block)
    };
  });

  // Output JSON
  const outputFile = path.join(__dirname, 'comment_compression_mapping.json');
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\nGenerated compression mapping saved to: ${outputFile}`);
  console.log(`Total blocks: ${result.length}`);

  // Print summary
  console.log('\n=== SAMPLE OUTPUT (first 5 blocks) ===');
  result.slice(0, 5).forEach(item => {
    console.log(`\nBlock ${item.blockNum} (lines ${item.startLine}-${item.endLine}, ${item.lineCount} lines)`);
    console.log(`Preview: ${item.preview}`);
    console.log(`Compressed: ${item.compressed}`);
  });

  console.log('\n=== BLOCKS 21-30 (continuing from previous analysis) ===');
  result.slice(20, 30).forEach(item => {
    console.log(`\nBlock ${item.blockNum} (lines ${item.startLine}-${item.endLine}, ${item.lineCount} lines)`);
    console.log(`Preview: ${item.preview}`);
    console.log(`Compressed: ${item.compressed}`);
  });
}

main();
