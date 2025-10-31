#!/usr/bin/env node
/**
 * Convert Meteor.callAsync callbacks to async/await
 * Handles common patterns found in MoFACTS codebase
 */

const fs = require('fs');

function convertCallbacks(content) {
  let modified = content;

  // Pattern 1: Simple callback in event handler
  // Meteor.callAsync('method', arg, function(err, res) { if (err) {...} else {...} });
  // This is the most complex conversion

  // Pattern 2: Fire-and-forget calls (no callback) - already OK
  // Meteor.callAsync('method', arg);  // Already good!

  // Pattern 3: Callback with error check and action
  // Meteor.callAsync('method', function(err, res) {
  //   if (err) { console.log(err); return; }
  //   // use res
  // });

  // Replace pattern: function(err, result) with proper try/catch
  const callbackPattern = /Meteor\.callAsync\(([^,]+(?:,\s*[^,]+)*),\s*function\s*\((\w+),\s*(\w+)\)\s*\{([\s\S]*?)\}\s*\)/g;

  modified = modified.replace(callbackPattern, (match, args, errVar, resultVar, body) => {
    // Try to parse the callback body structure
    const lines = body.trim();

    // Check if it's a simple if (err) pattern
    const hasErrorCheck = lines.match(new RegExp(`if\\s*\\(\\s*${errVar}\\s*\\)`));

    if (hasErrorCheck) {
      // Extract error handling and success code
      // This is a simplified version - may need manual fixing
      return `(async () => {
  try {
    const ${resultVar} = await Meteor.callAsync(${args});
${lines.replace(new RegExp(`if\\s*\\(\\s*${errVar}\\s*\\)[\\s\\S]*?\\}\\s*else\\s*\\{`, 'g'), '').replace(/\}$/, '')}
  } catch (${errVar}) {
${lines.match(new RegExp(`if\\s*\\(\\s*${errVar}\\s*\\)\\s*\\{([\\s\\S]*?)\\}`, 'g'))?.[0]?.replace(/if.*?\{/, '').replace(/\}$/, '') || '    console.error(' + errVar + ');'}
  }
})()`;
    }

    // Simple callback without error handling
    return `(async () => {
  try {
    const ${resultVar} = await Meteor.callAsync(${args});
${lines}
  } catch (${errVar}) {
    console.error('Error:', ${errVar});
  }
})()`;
  });

  return modified;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const converted = convertCallbacks(content);

  if (content !== converted) {
    fs.writeFileSync(filePath, converted);
    return true;
  }

  return false;
}

// Get file path from command line
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node convert-callbacks.js <file-path>');
  process.exit(1);
}

if (processFile(filePath)) {
  console.log(`✓ Converted: ${filePath}`);
} else {
  console.log(`- No changes: ${filePath}`);
}
