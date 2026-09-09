import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const toolAppRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1')), '..', '..');
const sourceRepoRoot = path.resolve(toolAppRoot, '..');
const appRoot = path.join(sourceRepoRoot, 'mofacts');
const manifestPath = path.join(appRoot, 'security-surface-contract.json');

async function filesUnder(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(full));
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(full);
  }
  return files;
}

function propertyName(property) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) {
    return property.name.text;
  }
  return null;
}

function methodNamesFromObject(object) {
  return object.properties
    .filter((property) => ts.isMethodDeclaration(property) || ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
    .map(propertyName)
    .filter(Boolean);
}

function discoverMethods(sourceFile) {
  const names = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text.match(/^create.*Methods$/) && node.body) {
      for (const statement of node.body.statements) {
        if (ts.isReturnStatement(statement) && statement.expression && ts.isObjectLiteralExpression(statement.expression)) {
          names.push(...methodNamesFromObject(statement.expression));
        }
      }
    }
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && ['methods', 'asyncMethods', 'publicExperimentMethods'].includes(node.name.text)
      && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      names.push(...methodNamesFromObject(node.initializer));
    }
    if (ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(sourceFile) === 'Meteor'
      && node.expression.name.text === 'methods'
      && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
      names.push(...methodNamesFromObject(node.arguments[0]));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return names;
}

function regexMatches(text, pattern, mapper) {
  return [...text.matchAll(pattern)].map(mapper);
}

export async function discoverSecuritySurfaces() {
  const serverFiles = await filesUnder(path.join(appRoot, 'server'));
  const methods = [];
  const publications = [];
  const httpRoutes = [];
  for (const file of serverFiles) {
    const text = await fs.readFile(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    methods.push(...discoverMethods(source));
    publications.push(...regexMatches(text, /Meteor\.publish\(\s*(?:'([^']+)'|null)/g,
      (match) => match[1] || '<default>'));
    httpRoutes.push(...regexMatches(text, /connectHandlers\.use\(\s*'([^']+)'/g, (match) => match[1]));
  }
  const routePolicyText = await fs.readFile(
    path.join(appRoot, 'client', 'lib', 'adminUi', 'managementRoutePresentationPolicies.ts'), 'utf8',
  );
  const managementRoutes = regexMatches(
    routePolicyText,
    /routeName:\s*'([^']+)'\s*,\s*path:\s*'([^']+)'/g,
    (match) => `${match[1]}|${match[2]}`,
  );
  const uniqueMethods = [...new Set(methods)].sort();
  const uniqueHttpRoutes = [...new Set(httpRoutes)].sort();
  const exports = [
    ...uniqueMethods.filter((name) => /(?:download|export|package)/i.test(name)).map((name) => `method:${name}`),
    ...uniqueHttpRoutes.filter((name) => /(?:download|backup)/i.test(name)).map((name) => `http:${name}`),
  ].sort();
  return {
    methods: uniqueMethods,
    publications: [...new Set(publications)].sort(),
    httpRoutes: uniqueHttpRoutes,
    exports,
    managementRoutes: [...new Set(managementRoutes)].sort(),
  };
}

function names(entries) {
  return entries.map((entry) => entry.name).sort();
}

function compare(kind, actual, expected) {
  const missing = actual.filter((name) => !expected.includes(name));
  const removed = expected.filter((name) => !actual.includes(name));
  return { kind, missing, removed };
}

if (process.argv.includes('--discover')) {
  process.stdout.write(`${JSON.stringify(await discoverSecuritySurfaces(), null, 2)}\n`);
} else {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const actual = await discoverSecuritySurfaces();
  const comparisons = [
    compare('methods', actual.methods, names(manifest.methods)),
    compare('publications', actual.publications, names(manifest.publications)),
    compare('httpRoutes', actual.httpRoutes, names(manifest.httpRoutes)),
    compare('exports', actual.exports, names(manifest.exports)),
    compare('managementRoutes', actual.managementRoutes, names(manifest.managementRoutes)),
  ];
  const invalidPolicies = Object.entries(manifest)
    .filter(([, entries]) => Array.isArray(entries))
    .flatMap(([kind, entries]) => entries.filter((entry) =>
      !['public', 'public-rate-limited', 'authenticated-self', 'role-checked', 'admin-only', 'signed-ingestion', 'single-use-download'].includes(entry.access))
      .map((entry) => `${kind}:${entry.name}`));
  const failures = comparisons.filter((comparison) => comparison.missing.length || comparison.removed.length);
  if (failures.length || invalidPolicies.length) {
    process.stderr.write('Security surface contract is out of date or contains an invalid access classification.\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(`Security surface contract covers ${Object.values(actual).flat().length} surfaces.\n`);
  }
}
