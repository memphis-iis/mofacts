#!/usr/bin/env node

/**
 * find-unused-files.js
 * Finds potentially unused HTML and JS files in the Meteor project
 *
 * Usage: node find-unused-files.js
 */

const fs = require('fs');
const path = require('path');

// Directories to exclude from scanning
const EXCLUDE_DIRS = [
  'node_modules',
  '.meteor',
  '.git',
  'dist',
  'build',
  '.npm',
  'packages/npm-container',
];

// Files to always consider as "used" (entry points and special files)
const ALWAYS_USED = [
  'client/index.js',
  'client/index.html',
  'server/main.js',
  'server/methods.js',
  'common/Collections.js',
  'common/Definitions.js',
  'common/globalHelpers.js',
  'packages/mofacts-accounts-microsoft/package.js',
  'packages/mofacts-microsoft-oauth/package.js',
];

class UnusedFileFinder {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.allFiles = [];
    this.fileContents = new Map();
    this.templateNames = new Map(); // templateName -> file path
    this.unusedFiles = [];
  }

  /**
   * Check if a path should be excluded
   */
  shouldExclude(filePath) {
    const relativePath = path.relative(this.rootDir, filePath);
    return EXCLUDE_DIRS.some(dir => relativePath.startsWith(dir));
  }

  /**
   * Check if a file is always considered used
   */
  isAlwaysUsed(filePath) {
    const relativePath = path.relative(this.rootDir, filePath).replace(/\\/g, '/');
    return ALWAYS_USED.some(pattern => relativePath.endsWith(pattern));
  }

  /**
   * Recursively scan directory for HTML and JS files
   */
  scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!this.shouldExclude(fullPath)) {
          this.scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if ((ext === '.js' || ext === '.html') && !this.shouldExclude(fullPath)) {
          this.allFiles.push(fullPath);
        }
      }
    }
  }

  /**
   * Read all files and cache their contents
   */
  readAllFiles() {
    console.log(`Reading ${this.allFiles.length} files...`);

    for (const filePath of this.allFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.fileContents.set(filePath, content);
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
      }
    }
  }

  /**
   * Extract template names from HTML files
   */
  extractTemplateNames() {
    for (const [filePath, content] of this.fileContents.entries()) {
      if (path.extname(filePath) !== '.html') continue;

      // Match <template name="templateName">
      const templateRegex = /<template\s+name=["']([^"']+)["']/g;
      let match;

      while ((match = templateRegex.exec(content)) !== null) {
        const templateName = match[1];
        if (!this.templateNames.has(templateName)) {
          this.templateNames.set(templateName, []);
        }
        this.templateNames.get(templateName).push(filePath);
      }
    }

    console.log(`Found ${this.templateNames.size} template names in HTML files`);
  }

  /**
   * Check if a file is referenced anywhere in the codebase
   */
  isFileReferenced(filePath) {
    const fileName = path.basename(filePath);
    const fileNameNoExt = path.basename(filePath, path.extname(filePath));
    const relativePath = path.relative(this.rootDir, filePath).replace(/\\/g, '/');

    // Check if it's an always-used file
    if (this.isAlwaysUsed(filePath)) {
      return { used: true, reason: 'Entry point or core file' };
    }

    // For HTML files, check if templates are referenced
    if (path.extname(filePath) === '.html') {
      const content = this.fileContents.get(filePath);
      const templateRegex = /<template\s+name=["']([^"']+)["']/g;
      let match;
      const templates = [];

      while ((match = templateRegex.exec(content)) !== null) {
        templates.push(match[1]);
      }

      if (templates.length === 0) {
        // HTML file with no templates - might be a layout or index file
        if (fileName === 'index.html') {
          return { used: true, reason: 'Index file' };
        }
      }

      // Check if any of the templates are referenced
      for (const templateName of templates) {
        if (this.isTemplateReferenced(templateName)) {
          return { used: true, reason: `Template '${templateName}' is referenced` };
        }
      }

      return { used: false, reason: `Templates ${templates.join(', ')} not referenced` };
    }

    // For JS files, check imports and requires
    const patterns = [
      // Direct file name matches
      new RegExp(`['"\`].*${this.escapeRegex(fileNameNoExt)}(\\.js)?['"\`]`, 'g'),
      // Relative path imports
      new RegExp(`['"\`]\\.\\.?/.*${this.escapeRegex(fileNameNoExt)}(\\.js)?['"\`]`, 'g'),
      // Path-based imports
      new RegExp(`['"\`].*${this.escapeRegex(relativePath.replace(/\\/g, '/'))}['"\`]`, 'g'),
      // Template helpers (e.g., Template.templateName)
      new RegExp(`Template\\.${this.escapeRegex(fileNameNoExt)}`, 'g'),
    ];

    for (const [otherFilePath, content] of this.fileContents.entries()) {
      if (otherFilePath === filePath) continue;

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          const otherFileRelative = path.relative(this.rootDir, otherFilePath);
          return { used: true, reason: `Referenced in ${otherFileRelative}` };
        }
      }
    }

    return { used: false, reason: 'No references found' };
  }

  /**
   * Check if a template name is referenced anywhere
   */
  isTemplateReferenced(templateName) {
    const patterns = [
      // Template inclusion: {{> templateName}}
      new RegExp(`\\{\\{>\\s*${this.escapeRegex(templateName)}\\s*[}|)]`, 'g'),
      // Template reference: Template.templateName
      new RegExp(`Template\\.${this.escapeRegex(templateName)}\\b`, 'g'),
      // Dynamic template: {{> Template.dynamic template="templateName"}}
      new RegExp(`template=["']${this.escapeRegex(templateName)}["']`, 'g'),
      // Iron Router template config
      new RegExp(`template:\\s*["']${this.escapeRegex(templateName)}["']`, 'g'),
    ];

    for (const content of this.fileContents.values()) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Find all unused files
   */
  findUnusedFiles() {
    console.log('\nAnalyzing file usage...\n');

    const results = {
      unused: [],
      used: [],
    };

    for (const filePath of this.allFiles) {
      const result = this.isFileReferenced(filePath);
      const relativePath = path.relative(this.rootDir, filePath);

      if (result.used) {
        results.used.push({ path: relativePath, reason: result.reason });
      } else {
        results.unused.push({ path: relativePath, reason: result.reason });
      }
    }

    return results;
  }

  /**
   * Generate report
   */
  generateReport(results) {
    console.log('='.repeat(80));
    console.log('UNUSED FILES REPORT');
    console.log('='.repeat(80));
    console.log(`\nTotal files scanned: ${this.allFiles.length}`);
    console.log(`Used files: ${results.used.length}`);
    console.log(`Potentially unused files: ${results.unused.length}`);

    if (results.unused.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('POTENTIALLY UNUSED FILES:');
      console.log('='.repeat(80));

      // Group by directory
      const byDir = {};
      for (const file of results.unused) {
        const dir = path.dirname(file.path);
        if (!byDir[dir]) byDir[dir] = [];
        byDir[dir].push(file);
      }

      for (const [dir, files] of Object.entries(byDir).sort()) {
        console.log(`\n${dir}/`);
        for (const file of files) {
          const fileName = path.basename(file.path);
          console.log(`  - ${fileName}`);
          console.log(`    Reason: ${file.reason}`);
        }
      }

      console.log('\n' + '='.repeat(80));
      console.log('WARNINGS:');
      console.log('='.repeat(80));
      console.log('* Files listed above may still be used through dynamic imports');
      console.log('* Verify each file before deleting');
      console.log('* Check for string-based template names or path references');
      console.log('* Review package.js files in local packages');
    } else {
      console.log('\n✓ No unused files detected!');
    }

    // Write detailed report to file
    const reportPath = path.join(this.rootDir, 'unused-files-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nDetailed report written to: ${path.relative(this.rootDir, reportPath)}`);
  }

  /**
   * Main execution
   */
  run() {
    console.log('Starting unused file detection...');
    console.log(`Root directory: ${this.rootDir}\n`);

    // Step 1: Scan directory
    console.log('Scanning directories...');
    this.scanDirectory(this.rootDir);

    // Step 2: Read all files
    this.readAllFiles();

    // Step 3: Extract template names
    this.extractTemplateNames();

    // Step 4: Find unused files
    const results = this.findUnusedFiles();

    // Step 5: Generate report
    this.generateReport(results);
  }
}

// Run the finder
const rootDir = path.resolve(__dirname);
const finder = new UnusedFileFinder(rootDir);
finder.run();
