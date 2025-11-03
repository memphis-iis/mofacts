// Script to find undeclared variable assignments (Meteor 3 strict mode issues)
const fs = require('fs');
const path = require('path');

function findUndeclaredVariables(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) {
      continue;
    }

    // Pattern: variable assignment without const/let/var
    // Match: "  variableName = value" but not "  const variableName = value"
    const pattern = /^\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/;
    const match = line.match(pattern);

    if (match) {
      const varName = match[1];

      // Exclude valid patterns
      if (
        line.includes('const ' + varName) ||
        line.includes('let ' + varName) ||
        line.includes('var ' + varName) ||
        line.includes('this.' + varName) ||
        line.includes('===') ||
        line.includes('!==') ||
        line.includes('==') ||
        line.includes('!=') ||
        line.includes('<=') ||
        line.includes('>=')
      ) {
        continue;
      }

      issues.push({
        file: path.basename(filePath),
        line: lineNum,
        variable: varName,
        code: line.trim()
      });
    }
  }

  return issues;
}

// Scan server files
const serverDir = 'c:\\Users\\ppavl\\OneDrive\\Active projects\\mofacts\\mofacts\\server';
const files = ['methods.js', 'turk_methods.js', 'experiment_times.js', 'publications.js'];

let allIssues = [];
files.forEach(file => {
  const filePath = path.join(serverDir, file);
  if (fs.existsSync(filePath)) {
    const issues = findUndeclaredVariables(filePath);
    allIssues = allIssues.concat(issues);
  }
});

console.log('Found', allIssues.length, 'potential undeclared variable assignments:\n');
allIssues.forEach(issue => {
  console.log(`${issue.file}:${issue.line} - ${issue.variable} = ...`);
  console.log(`  ${issue.code}\n`);
});

if (allIssues.length > 0) {
  console.log('\nThese variables need to be declared with const/let/var for Meteor 3 strict mode.');
}
