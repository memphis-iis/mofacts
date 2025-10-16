const {doubleMetaphone} = require('double-metaphone');

const words = ['mali', 'malawi', 'molly', 'malley', 'mally'];

console.log('Double Metaphone codes:');
words.forEach(word => {
  const codes = doubleMetaphone(word);
  console.log(`  ${word.padEnd(10)} -> primary: "${codes[0]}", secondary: "${codes[1] || 'none'}"`);
});
