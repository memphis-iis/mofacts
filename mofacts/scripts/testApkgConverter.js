/**
 * Test script for .apkg to MoFaCTS conversion
 * Run with: node scripts/testApkgConverter.js
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const initSqlJs = require('sql.js');

const US = '\x1f'; // Anki field separator

/**
 * Strip HTML tags from text
 */
function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, '').trim();
}

/**
 * Split Anki note fields (US-separated)
 */
function splitFields(fldsRaw) {
  return (fldsRaw || '').split(US);
}

/**
 * Extract media references from HTML fields
 */
function extractMediaRefs(fields) {
  const refs = new Set();
  for (const f of fields) {
    if (!f) continue;
    const regex = /<img[^>]+src=['"]([^'"]+)['"]|(?:\[sound:([^\]]+)\])/g;
    for (const m of f.matchAll(regex)) {
      const candidate = m[1] || m[2];
      if (candidate) refs.add(candidate);
    }
  }
  return [...refs];
}

/**
 * Query all rows from SQLite
 */
function queryAll(db, sql) {
  const stmt = db.prepare(sql);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Convert .apkg to MoFaCTS format
 */
async function convertApkg(apkgPath, outputDir) {
  console.log(`Converting ${apkgPath}...`);

  // Read the .apkg file
  const apkgBuffer = fs.readFileSync(apkgPath);
  const zip = await JSZip.loadAsync(apkgBuffer);

  console.log('Files in .apkg:');
  zip.forEach((relativePath, file) => {
    console.log(`  - ${relativePath}`);
  });

  // Try to find collection database
  let sqliteBytes;
  const c21 = zip.file('collection.anki21');
  const c2 = zip.file('collection.anki2');

  if (c21) {
    console.log('Found collection.anki21');
    sqliteBytes = await c21.async('uint8array');
  } else if (c2) {
    console.log('Found collection.anki2');
    sqliteBytes = await c2.async('uint8array');
  } else {
    throw new Error('No collection database found');
  }

  // Load media index
  let mediaIndex = {};
  const mediaJson = zip.file('media');
  if (mediaJson) {
    const txt = await mediaJson.async('string');
    mediaIndex = JSON.parse(txt || '{}');
    console.log(`Found ${Object.keys(mediaIndex).length} media files`);
  }

  // Open SQLite database
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(sqliteBytes));

  // Get models and decks
  const colRows = queryAll(db, 'SELECT models, decks FROM col');
  const models = colRows.length > 0 ? JSON.parse(colRows[0].models || '{}') : {};
  const decks = colRows.length > 0 ? JSON.parse(colRows[0].decks || '{}') : {};

  console.log('Decks:', Object.values(decks).map(d => d.name));
  console.log('Models:', Object.values(models).map(m => m.name));

  // Build model index
  const modelIndex = new Map();
  for (const [id, m] of Object.entries(models)) {
    modelIndex.set(parseInt(id, 10), {
      name: m.name || `Model_${id}`,
      isCloze: (m.name || '').toLowerCase().includes('cloze')
    });
  }

  // Build deck index
  const deckIndex = new Map();
  for (const [id, d] of Object.entries(decks)) {
    deckIndex.set(parseInt(id, 10), d.name || `Deck_${id}`);
  }

  // Load notes
  const notes = new Map();
  for (const row of queryAll(db, 'SELECT id, guid, mid, flds, tags FROM notes')) {
    notes.set(row.id, {
      id: row.id,
      guid: row.guid,
      mid: row.mid,
      fields: splitFields(row.flds),
      tags: row.tags || ''
    });
  }

  console.log(`Found ${notes.size} notes`);

  // Process cards
  const cards = [];
  let primaryDeckName = null;

  for (const row of queryAll(db, 'SELECT id, nid, did, ord FROM cards')) {
    const { id: cid, nid, did, ord } = row;
    const note = notes.get(nid);
    if (!note) continue;

    const model = modelIndex.get(note.mid);
    const deckName = deckIndex.get(did) || `Deck_${did}`;
    if (!primaryDeckName) primaryDeckName = deckName;

    const isCloze = model ? model.isCloze : false;

    // Extract prompt and answer
    let prompt, answer;
    if (isCloze) {
      // Simplified cloze handling
      const text = note.fields[0] || '';
      prompt = stripHtml(text);
      answer = stripHtml(text);
    } else {
      // Basic card: field 0 = front, field 1 = back
      prompt = stripHtml(note.fields[0] || '');
      answer = stripHtml(note.fields[1] || '');
    }

    // Extract media
    const mediaRefs = extractMediaRefs(note.fields);
    const mediaNames = mediaRefs.map(r => {
      const n = Number(r);
      if (Number.isFinite(n) && String(n) === r && mediaIndex[r]) {
        return mediaIndex[r];
      }
      return r;
    });
    const hasImage = mediaNames.some(m => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m));

    cards.push({
      id: cid,
      prompt,
      answer,
      media: mediaNames,
      hasImage,
      deck: deckName,
      tags: note.tags
    });
  }

  console.log(`Found ${cards.length} cards`);

  // Show first few cards
  console.log('\nFirst 3 cards:');
  cards.slice(0, 3).forEach((card, i) => {
    console.log(`\nCard ${i + 1}:`);
    console.log(`  Prompt: ${card.prompt.substring(0, 100)}...`);
    console.log(`  Answer: ${card.answer.substring(0, 100)}...`);
    console.log(`  Media: ${card.media.join(', ')}`);
    console.log(`  Has image: ${card.hasImage}`);
  });

  // Build MoFaCTS stims structure
  const clusters = cards.map(card => {
    const stim = {
      response: {
        correctResponse: card.answer
      },
      display: {}
    };

    // Add text if no image
    if (!card.hasImage) {
      stim.display.text = card.prompt;
    }

    // Add image if present
    if (card.hasImage && card.media.length > 0) {
      const imgFile = card.media.find(m => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m));
      if (imgFile) {
        stim.display.imgSrc = imgFile;
      }
      // Also include text if image has prompt text
      if (card.prompt) {
        stim.display.text = card.prompt;
      }
    }

    return { stims: [stim] };
  });

  const stims = {
    setspec: {
      clusters
    }
  };

  // Build MoFaCTS TDF structure
  const stimFilename = `${primaryDeckName || 'imported'}_stims.json`;

  // Standard adaptive learning model formula
  const calculateProbability = 'p.y = -3 + .508* pFunc.logitdec( p.overallOutcomeHistory.slice( Math.max(p.overallOutcomeHistory.length-60,  0),   p.overallOutcomeHistory.length),  .974)+ 1.4 * Math.log(1+p.stimSuccessCount) + 7.98 * pFunc.recency(p.stimSecsSinceLastShown,  .115) ;  var lastElements = p.overallOutcomeHistory.slice(Math.max(p.overallOutcomeHistory.length - 60,  0),  p.overallOutcomeHistory.length); var sum = lastElements.reduce((accumulator,  currentValue) => accumulator + currentValue,  0); var average = sum / (lastElements.length); p.probability = 1.0 / (1.0 + Math.exp(-p.y));  if ( p.overallStudyHistory && p.overallStudyHistory.length % 4 !== 0 && average > p.stimParameters[1] && p.probability > p.stimParameters[1]) {p.probability = 1 / (1 + Math.exp(-(Math.log(p.probability / (1 - p.probability)) + 6)));}  return p\n';

  const tdf = {
    tutor: {
      setspec: {
        lessonname: `${primaryDeckName} (imported from Anki)`,
        stimulusfile: stimFilename,
        shuffleclusters: `0-${cards.length - 1}`,
        userselect: 'true',
        lfparameter: '0.85'
      },
      unit: [
        {
          unitname: 'Instructions',
          unitinstructions: '<p>This lesson was imported from an Anki deck.</p><p>Study each card and type your answer when prompted.</p>'
        },
        {
          unitname: 'Practice',
          learningsession: {
            clusterlist: `0-${cards.length - 1}`,
            unitMode: 'distance',
            calculateProbability: calculateProbability
          },
          deliveryparams: {
            purestudy: '10000',
            drill: '10000',
            skipstudy: 'false',
            reviewstudy: '5000',
            correctprompt: '500',
            fontsize: '3',
            correctscore: '1',
            incorrectscore: '0',
            optimalThreshold: '.8',
            practiceseconds: '1000000'
          }
        }
      ]
    }
  };

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write TDF
  const tdfPath = path.join(outputDir, `${primaryDeckName}_TDF.json`);
  fs.writeFileSync(tdfPath, JSON.stringify(tdf, null, 2));
  console.log(`\nWrote TDF to: ${tdfPath}`);

  // Write stims
  const stimsPath = path.join(outputDir, stimFilename);
  fs.writeFileSync(stimsPath, JSON.stringify(stims, null, 2));
  console.log(`Wrote stims to: ${stimsPath}`);

  // Extract media files
  let mediaCount = 0;
  for (const [numStr, filename] of Object.entries(mediaIndex)) {
    const entry = zip.file(numStr);
    if (!entry) continue;

    const data = await entry.async('nodebuffer');
    const mediaPath = path.join(outputDir, filename);
    fs.writeFileSync(mediaPath, data);
    mediaCount++;
  }

  console.log(`Extracted ${mediaCount} media files`);

  return {
    tdfPath,
    stimsPath,
    cardCount: cards.length,
    mediaCount,
    deckName: primaryDeckName
  };
}

// Run if called directly
if (require.main === module) {
  const apkgPath = process.argv[2] || 'C:\\Users\\ppavl\\OneDrive\\Active projects\\mofacts_config\\US_Presidents_w_pics.apkg';
  const outputDir = process.argv[3] || path.join(__dirname, '..', 'test_output');

  convertApkg(apkgPath, outputDir)
    .then(result => {
      console.log('\n=== Conversion Complete ===');
      console.log(`Deck: ${result.deckName}`);
      console.log(`Cards: ${result.cardCount}`);
      console.log(`Media files: ${result.mediaCount}`);
      console.log(`Output directory: ${outputDir}`);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { convertApkg };
