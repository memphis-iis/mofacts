const fs = require('fs');
const path = require('path');

// Compress multi-line comments to single line
function compressComments(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const compressed = [];

  let inBlockComment = false;
  let blockCommentLines = [];
  let blockCommentStart = -1;

  let consecutiveComments = [];
  let consecutiveStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const leadingWhitespace = line.match(/^(\s*)/)[1];

    // Handle /* */ block comments
    if (!inBlockComment && /\/\*/.test(line)) {
      inBlockComment = true;
      blockCommentStart = i;
      blockCommentLines = [line];

      // Check if comment closes on same line
      if (/\*\//.test(line)) {
        inBlockComment = false;
        compressed.push(line); // Single-line block comment, keep as-is
        blockCommentLines = [];
      }
      continue;
    }

    if (inBlockComment) {
      blockCommentLines.push(line);
      if (/\*\//.test(line)) {
        inBlockComment = false;
        // Compress block comment
        const compressedComment = compressBlockComment(blockCommentLines);
        compressed.push(compressedComment);
        blockCommentLines = [];
      }
      continue;
    }

    // Handle HTML comments <!-- -->
    if (/<!--/.test(line) && !/-->/.test(line)) {
      // Multi-line HTML comment starting
      blockCommentLines = [line];
      blockCommentStart = i;
      inBlockComment = 'html';
      continue;
    }

    if (inBlockComment === 'html') {
      blockCommentLines.push(line);
      if (/-->/.test(line)) {
        inBlockComment = false;
        // Compress HTML comment
        const compressedComment = compressHTMLComment(blockCommentLines);
        compressed.push(compressedComment);
        blockCommentLines = [];
      }
      continue;
    }

    // Handle consecutive // comments
    if (trimmed.startsWith('//') && !trimmed.startsWith('///')) {
      if (consecutiveComments.length === 0) {
        consecutiveStart = i;
      }
      consecutiveComments.push(line);
    } else {
      // Not a comment line
      if (consecutiveComments.length >= 2) {
        // Compress consecutive comments
        const compressedComment = compressConsecutiveComments(consecutiveComments);
        compressed.push(compressedComment);
      } else if (consecutiveComments.length === 1) {
        // Single comment, keep as-is
        compressed.push(consecutiveComments[0]);
      }
      consecutiveComments = [];

      // Add current line
      compressed.push(line);
    }
  }

  // Handle trailing consecutive comments
  if (consecutiveComments.length >= 2) {
    const compressedComment = compressConsecutiveComments(consecutiveComments);
    compressed.push(compressedComment);
  } else if (consecutiveComments.length === 1) {
    compressed.push(consecutiveComments[0]);
  }

  return compressed.join('\n');
}

// Compress /* */ block comments
function compressBlockComment(lines) {
  const leadingWhitespace = lines[0].match(/^(\s*)/)[1];

  // Extract comment text without /* */ and leading *
  const textLines = lines.map(line => {
    let text = line.trim();
    // Remove /* at start
    text = text.replace(/^\/\*+\s*/, '');
    // Remove */ at end
    text = text.replace(/\s*\*+\/$/, '');
    // Remove leading *
    text = text.replace(/^\*\s*/, '');
    return text.trim();
  }).filter(text => text.length > 0);

  const combined = textLines.join(' ');
  return `${leadingWhitespace}// ${combined}`;
}

// Compress HTML <!-- --> comments
function compressHTMLComment(lines) {
  const leadingWhitespace = lines[0].match(/^(\s*)/)[1];

  // Extract comment text without <!-- --> and decoration
  const textLines = lines.map(line => {
    let text = line.trim();
    // Remove <!-- at start
    text = text.replace(/^<!--\s*/, '');
    // Remove --> at end
    text = text.replace(/\s*-->$/, '');
    // Remove decoration lines (=====)
    if (/^=+$/.test(text)) return '';
    return text.trim();
  }).filter(text => text.length > 0);

  const combined = textLines.join(' - ');
  return `${leadingWhitespace}<!-- ${combined} -->`;
}

// Compress consecutive // comments
function compressConsecutiveComments(lines) {
  const leadingWhitespace = lines[0].match(/^(\s*)/)[1];

  // Extract comment text without //
  const textLines = lines.map(line => {
    let text = line.trim();
    text = text.replace(/^\/\/+\s*/, '');
    // Skip decoration lines
    if (/^=+$/.test(text) || /^\/+$/.test(text)) return '';
    return text.trim();
  }).filter(text => text.length > 0);

  const combined = textLines.join(' ');
  return `${leadingWhitespace}// ${combined}`;
}

// Process files
const files = [
  'mofacts/client/views/experiment/card.html',
  'mofacts/client/views/experiment/card.js'
];

console.log('Compressing multi-line comments...\n');

files.forEach(relPath => {
  const fullPath = path.join(process.cwd(), relPath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ File not found: ${fullPath}`);
    return;
  }

  console.log(`Processing: ${relPath}`);

  // Create backup
  const backupPath = fullPath + '.backup';
  fs.copyFileSync(fullPath, backupPath);
  console.log(`  ✓ Backup created: ${backupPath}`);

  // Compress comments
  const compressed = compressComments(fullPath);

  // Write compressed version
  fs.writeFileSync(fullPath, compressed, 'utf8');
  console.log(`  ✓ Comments compressed`);
});

console.log('\n✓ Done! Backup files created with .backup extension');
