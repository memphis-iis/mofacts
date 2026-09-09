import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Characterization only: execute an exact first-party expression/callback with
// synthetic dependencies. Never evaluate a downloaded script, the whole scanner,
// or operator configuration. These witnesses do NOT prove Meteor wiring or I/O.
export function sourceFile(relativePath) {
  const url = new URL(`../../../../${relativePath}`, import.meta.url);
  return ts.createSourceFile(relativePath, fs.readFileSync(url, 'utf8'), ts.ScriptTarget.Latest, true);
}

export function findNodes(root, predicate) {
  const found = [];
  function visit(node) {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
  return found;
}

export function oneNode(root, predicate) {
  const found = findNodes(root, predicate);
  assert.equal(found.length, 1, 'Characterized source boundary changed; review rather than guessing another expression');
  return found[0];
}

export function initializer(root, name) {
  const declaration = oneNode(root, (node) => ts.isVariableDeclaration(node)
    && ts.isIdentifier(node.name) && node.name.text === name);
  assert.ok(declaration.initializer);
  return declaration.initializer;
}

export function evaluateNode(node, source, bindings = {}) {
  const text = node.getText(source).replace(/^export\s+/, '');
  const code = ts.transpileModule(`(${text})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return vm.runInNewContext(code, bindings, { timeout: 1000 });
}

export function namedFunction(source, name, bindings = {}) {
  return evaluateNode(oneNode(source, (node) => ts.isFunctionDeclaration(node) && node.name?.text === name), source, bindings);
}

export { ts };
