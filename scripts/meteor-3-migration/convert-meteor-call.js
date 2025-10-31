#!/usr/bin/env node
/**
 * Converts Meteor.call() to Meteor.callAsync() with proper async/await
 * This is a simple pattern matcher for common cases
 */

const fs = require('fs');
const path = require('path');

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: Simple callback with error handling
  // Meteor.call('method', function(err, result) { if (err) {...} else {...} });
  const pattern1 = /Meteor\.call\((['"])([^'"]+)\1,\s*function\s*\((\w+),\s*(\w+)\)\s*\{([^}]*if\s*\(\3\)[\s\S]*?)\}\s*\)/g;

  if (pattern1.test(content)) {
    console.log(`  Converting pattern 1 in ${path.basename(filePath)}`);
    content = content.replace(pattern1, (match, quote, method, errVar, resultVar, body) => {
      // Extract error and success blocks
      const lines = body.trim().split('\n');
      modified = true;
      return `(async () => {
  try {
    const ${resultVar} = await Meteor.callAsync(${quote}${method}${quote});
    // Success block - extract from else
  } catch (${errVar}) {
    // Error block
  }
})()`;
    });
  }

  // Pattern 2: Simple call with args and callback
  // This is a simplified version - just converts Meteor.call to Meteor.callAsync
  content = content.replace(/Meteor\.call\(/g, 'Meteor.callAsync(');

  // Note: This creates syntax errors that need manual fixing, but it marks all locations

  if (content !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath + '.converted', content);
    console.log(`✓ Converted: ${filePath}`);
    return true;
  }

  return false;
}

// Process all client JS files
const clientDir = process.argv[2] || './mofacts/client';

function processDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.name.endsWith('.js') && !file.name.includes('.converted')) {
      if (fs.readFileSync(fullPath, 'utf8').includes('Meteor.call(')) {
        console.log(`Processing: ${fullPath}`);
        convertFile(fullPath);
      }
    }
  }
}

console.log('Note: This creates .converted files that need manual review and fixing');
console.log('Starting conversion...\n');
// processDirectory(clientDir);
console.log('\nConversion approach changed - using manual conversion for safety');
