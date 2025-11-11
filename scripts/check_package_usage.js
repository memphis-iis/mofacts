const fs = require('fs');
const path = require('path');

// Recursively find all js/jsx/ts/tsx files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and .meteor
      if (file !== 'node_modules' && file !== '.meteor' && file !== '.npm') {
        findFiles(filePath, fileList);
      }
    } else if (/\.(js|jsx|ts|tsx|html)$/.test(file)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Check if a package is used in any file
function findPackageUsage(packageName, files) {
  const usageFiles = [];

  // Create regex patterns to match imports/requires
  const patterns = [
    new RegExp(`require\\(['"\`]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]\\)`, 'g'),
    new RegExp(`from ['"\`]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g'),
    new RegExp(`import ['"\`]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g'),
    new RegExp(`import .* from ['"\`]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g'),
  ];

  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          usageFiles.push(file.replace(/\\/g, '/').split('mofacts/')[1]);
          break;
        }
      }
    } catch (err) {
      // Skip files that can't be read
    }
  });

  return usageFiles;
}

// Main execution
console.log('Analyzing package usage in mofacts codebase...\n');

const mofactsDir = path.join(__dirname, 'mofacts');
const packageJsonPath = path.join(mofactsDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const allDeps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

const files = findFiles(mofactsDir);
console.log(`Found ${files.length} source files to analyze\n`);

const results = {
  used: [],
  unused: [],
  special: []
};

// Packages that are used indirectly
const specialPackages = {
  'meteor-node-stubs': 'Used by Meteor build system',
  '@types/jquery': 'TypeScript type definitions',
  '@types/meteor': 'TypeScript type definitions',
  '@types/meteor-roles': 'TypeScript type definitions',
  '@types/underscore': 'TypeScript type definitions',
  'eslint': 'Linter tool',
  'eslint-config-google': 'ESLint configuration',
  'chai': 'Test framework',
  'mochawesome': 'Test reporter',
  '@sinonjs/referee-sinon': 'Test utilities',
  'sinon': 'Test mocking',
  'expect': 'Test assertions',
  'pretty-format': 'Test output formatting',
  '@babel/runtime': 'Babel polyfills (auto-imported)',
  'core-js': 'Polyfills (may be auto-imported)',
  'util': 'Node.js core module polyfill',
  'http': 'Node.js core module polyfill',
  'punycode': 'Usually a dependency of other packages',
  'plyr': 'Loaded from CDN (see client/index.html)'
};

Object.entries(allDeps).forEach(([pkg, version]) => {
  if (specialPackages[pkg]) {
    results.special.push({ pkg, version, reason: specialPackages[pkg] });
  } else {
    const usage = findPackageUsage(pkg, files);
    if (usage.length > 0) {
      results.used.push({ pkg, version, files: usage });
    } else {
      results.unused.push({ pkg, version });
    }
  }
});

// Print results
console.log('═'.repeat(80));
console.log('✓ DIRECTLY USED PACKAGES (' + results.used.length + ')');
console.log('═'.repeat(80));
results.used.forEach(({ pkg, version, files }) => {
  console.log(`\n${pkg}@${version}`);
  console.log(`  Used in ${files.length} file(s):`);
  files.slice(0, 3).forEach(f => console.log(`    - ${f}`));
  if (files.length > 3) {
    console.log(`    ... and ${files.length - 3} more`);
  }
});

console.log('\n' + '═'.repeat(80));
console.log('⚙ BUILD TOOLS / INDIRECT USAGE (' + results.special.length + ')');
console.log('═'.repeat(80));
results.special.forEach(({ pkg, version, reason }) => {
  console.log(`${pkg}@${version}`);
  console.log(`  → ${reason}`);
});

console.log('\n' + '═'.repeat(80));
console.log('⚠ POTENTIALLY UNUSED (' + results.unused.length + ')');
console.log('═'.repeat(80));
if (results.unused.length === 0) {
  console.log('None found - all packages appear to be used!');
} else {
  results.unused.forEach(({ pkg, version }) => {
    console.log(`${pkg}@${version}`);
  });
  console.log('\nThese packages may be unused or have indirect usage not detected by this script.');
}

console.log('\n' + '═'.repeat(80));
console.log(`SUMMARY: ${results.used.length} used, ${results.special.length} build tools, ${results.unused.length} potentially unused`);
console.log('═'.repeat(80));
