const TEST_ONLY_METEOR_VERSION_PACKAGES = Object.freeze([
  'meteortesting:browser-tests',
  'meteortesting:mocha',
  'meteortesting:mocha-core',
]);

function meteorVersionPackageName(line) {
  return TEST_ONLY_METEOR_VERSION_PACKAGES.find((packageName) =>
    line.startsWith(`${packageName}@`),
  ) || null;
}

function findMeteorTestVersionArtifacts(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => meteorVersionPackageName(line) !== null);
}

function removeMeteorTestVersionArtifacts(content) {
  return content
    .split(/(?<=\n)/)
    .filter((line) => meteorVersionPackageName(line.replace(/\r?\n$/, '')) === null)
    .join('');
}

module.exports = {
  TEST_ONLY_METEOR_VERSION_PACKAGES,
  findMeteorTestVersionArtifacts,
  removeMeteorTestVersionArtifacts,
};
