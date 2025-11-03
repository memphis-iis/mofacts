// Advanced script to find REAL undeclared variables (Meteor 3 strict mode issues)
const fs = require('fs');
const path = require('path');

function analyzeFunction(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  // Track declared variables in each scope
  const declaredVars = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    // Track variable declarations (const/let/var)
    const declPattern = /(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let declMatch;
    while ((declMatch = declPattern.exec(line)) !== null) {
      declaredVars.add(declMatch[1]);
    }

    // Look for assignments WITHOUT declaration keywords
    // Pattern: spaces + variableName + spaces + = + not comparison operator
    const assignPattern = /^\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?![=>])/;
    const match = line.match(assignPattern);

    if (match) {
      const varName = match[1];

      // FILTERS - Exclude false positives:

      // 1. Skip if it has const/let/var on the same line
      if (line.includes('const ') || line.includes('let ') || line.includes('var ')) {
        continue;
      }

      // 2. Skip property assignments (this.x, obj.x)
      if (line.includes('this.' + varName) || /\w+\.\w+/.test(line.split('=')[0])) {
        continue;
      }

      // 3. Skip comparison operators
      if (line.includes('===') || line.includes('!==') ||
          line.includes('==') || line.includes('!=') ||
          line.includes('<=') || line.includes('>=')) {
        continue;
      }

      // 4. Skip if variable was declared earlier in file
      if (declaredVars.has(varName)) {
        continue; // This is a reassignment, not undeclared
      }

      // 5. Check if this looks like a FIRST assignment (likely bug)
      // Look backwards to see if variable was used before
      let usedBefore = false;
      for (let j = 0; j < i; j++) {
        if (lines[j].includes(varName) &&
            !lines[j].includes('function ' + varName) &&
            !lines[j].includes('const ' + varName) &&
            !lines[j].includes('let ' + varName) &&
            !lines[j].includes('var ' + varName)) {
          usedBefore = true;
          break;
        }
      }

      // 6. Categorize by severity
      let severity = 'LOW';
      if (!usedBefore) {
        severity = 'HIGH'; // First use is assignment without declaration - definitely a bug!
      } else {
        severity = 'MEDIUM'; // Variable used before, might be parameter or already declared
      }

      issues.push({
        file: path.basename(filePath),
        line: lineNum,
        variable: varName,
        code: line.trim(),
        severity: severity
      });
    }
  }

  return issues;
}

// Scan server files
const serverDir = 'c:\\Users\\ppavl\\OneDrive\\Active projects\\mofacts\\mofacts\\server';
const files = ['methods.js', 'turk_methods.js', 'experiment_times.js', 'publications.js'];

let highPriority = [];
let mediumPriority = [];
let lowPriority = [];

files.forEach(file => {
  const filePath = path.join(serverDir, file);
  if (fs.existsSync(filePath)) {
    const issues = analyzeFunction(filePath);
    issues.forEach(issue => {
      if (issue.severity === 'HIGH') highPriority.push(issue);
      else if (issue.severity === 'MEDIUM') mediumPriority.push(issue);
      else lowPriority.push(issue);
    });
  }
});

console.log('='.repeat(80));
console.log('METEOR 3 UNDECLARED VARIABLES SCAN');
console.log('='.repeat(80));
console.log(`\nTotal issues found: ${highPriority.length + mediumPriority.length + lowPriority.length}`);
console.log(`  HIGH priority (first assignment without declaration): ${highPriority.length}`);
console.log(`  MEDIUM priority (likely reassignment): ${mediumPriority.length}`);
console.log(`  LOW priority (filtered out): ${lowPriority.length}\n`);

if (highPriority.length > 0) {
  console.log('='.repeat(80));
  console.log('HIGH PRIORITY - These will cause ReferenceError in Meteor 3 strict mode:');
  console.log('='.repeat(80));
  highPriority.forEach(issue => {
    console.log(`\n${issue.file}:${issue.line}`);
    console.log(`  Variable: ${issue.variable}`);
    console.log(`  Code: ${issue.code}`);
  });
}

if (mediumPriority.length > 0 && mediumPriority.length < 30) {
  console.log('\n' + '='.repeat(80));
  console.log('MEDIUM PRIORITY - Review these (might be reassignments):');
  console.log('='.repeat(80));
  mediumPriority.slice(0, 20).forEach(issue => {
    console.log(`${issue.file}:${issue.line} - ${issue.variable}`);
  });
  if (mediumPriority.length > 20) {
    console.log(`... and ${mediumPriority.length - 20} more`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('RECOMMENDATION:');
console.log('='.repeat(80));
console.log('Fix HIGH priority issues immediately - these WILL crash in production.');
console.log('Review MEDIUM priority - most are likely false positives (reassignments).');
console.log('='.repeat(80));
