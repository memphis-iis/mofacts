/**
 * Anki .apkg to MoFaCTS TDF/Stims Converter
 * Converts Anki package files to MoFaCTS-compatible JSON format
 *
 * NOTE: This module is currently unused on the server.
 * Conversion happens client-side in contentUpload.js
 *
 * Dependencies: jszip, sql.js, @kdzwinel/zstddec
 *
 * Usage:
 *   const { convertApkgToMofacts } = require('./apkgConverter');
 *   const result = await convertApkgToMofacts(apkgBuffer, options);
 */

// NOTE: Imports commented out - conversion happens client-side
// Uncomment if server-side conversion is needed in the future
// import JSZip from 'jszip';
// import initSqlJs from 'sql.js';
// import { ZstdInit, ZstdSimple } from '@kdzwinel/zstddec';

const US = '\x1f'; // Anki field separator
const CLOZE_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;

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
 * Matches: <img src="...">, [sound:...]
 */
function extractMediaRefs(fields) {
  const refs = new Set();
  for (const f of fields) {
    if (!f) continue;
    // Match img src and sound tags
    const regex = /<img[^>]+src=['"]([^'"]+)['"]|(?:\[sound:([^\]]+)\])/g;
    for (const m of f.matchAll(regex)) {
      const candidate = m[1] || m[2];
      if (candidate) refs.add(candidate);
    }
  }
  return [...refs];
}

/**
 * Convert cloze text to masked prompt for specific ordinal
 */
function clozeMaskToPrompt(text, ord) {
  return (text || '').replace(CLOZE_RE, (m, idx, body, hint) => {
    const i = parseInt(idx, 10);
    if (i === ord + 1) {
      return hint ? `[... : ${hint}]` : `[...]`;
    }
    return body;
  });
}

/**
 * Extract cloze answer for specific ordinal
 */
function clozeAnswer(text, ord) {
  const targetVals = [];
  (text || '').replace(CLOZE_RE, (m, idx, body) => {
    if (parseInt(idx, 10) === ord + 1) {
      targetVals.push(stripHtml(body));
    }
  });
  return targetVals.join('; ');
}

/**
 * Decompress zstd-compressed data
 */
async function decompressZstd(compressedData) {
  await ZstdInit();
  const zstd = new ZstdSimple();
  return zstd.decompress(compressedData);
}

/**
 * Load and parse collection database from .apkg
 */
async function getCollectionDb(zip) {
  // Try collection.anki21b (zstd compressed), then .anki21, then .anki2
  const c21b = zip.file('collection.anki21b');
  const c21 = zip.file('collection.anki21');
  const c2 = zip.file('collection.anki2');

  let sqliteBytes;

  if (c21b) {
    const compressed = await c21b.async('uint8array');
    sqliteBytes = await decompressZstd(compressed);
  } else if (c21) {
    sqliteBytes = await c21.async('uint8array');
  } else if (c2) {
    sqliteBytes = await c2.async('uint8array');
  } else {
    throw new Error('No collection database found in .apkg');
  }

  const SQL = await initSqlJs();
  return new SQL.Database(new Uint8Array(sqliteBytes));
}

/**
 * Load media index (maps numeric IDs to filenames)
 */
async function getMediaIndex(zip) {
  const mediaJson = zip.file('media');
  if (mediaJson) {
    const txt = await mediaJson.async('string');
    return JSON.parse(txt || '{}');
  }

  const mediaZ = zip.file('media.zstd');
  if (mediaZ) {
    const compressed = await mediaZ.async('uint8array');
    const decompressed = await decompressZstd(compressed);
    const txt = new TextDecoder('utf-8').decode(decompressed);
    return JSON.parse(txt || '{}');
  }

  return {};
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
 * Parse models and decks from collection
 */
function getModelsAndDecks(db) {
  const rows = queryAll(db, 'SELECT models, decks FROM col');
  if (!rows.length) return [{}, {}];

  const models = JSON.parse(rows[0].models || '{}');
  const decks = JSON.parse(rows[0].decks || '{}');

  return [models, decks];
}

/**
 * Build model index (mid -> name)
 */
function buildModelIndex(models) {
  const index = new Map();
  for (const [id, m] of Object.entries(models)) {
    index.set(parseInt(id, 10), {
      name: m.name || `Model_${id}`,
      isCloze: (m.name || '').toLowerCase().includes('cloze')
    });
  }
  return index;
}

/**
 * Build deck index (did -> name)
 */
function buildDeckIndex(decks) {
  const index = new Map();
  for (const [id, d] of Object.entries(decks)) {
    index.set(parseInt(id, 10), d.name || `Deck_${id}`);
  }
  return index;
}

/**
 * Extract prompt and answer from Anki fields
 */
function extractPromptAnswer(fields, isCloze, ord, keepHtml = false) {
  if (isCloze) {
    const text = fields[0] || '';
    const promptMasked = clozeMaskToPrompt(text, ord);
    const answer = clozeAnswer(text, ord);

    return {
      prompt: keepHtml ? promptMasked : stripHtml(promptMasked),
      answer: answer || stripHtml(text)
    };
  } else {
    // Basic card: field 0 = front, field 1 = back
    const front = fields[0] || '';
    const back = fields[1] || '';

    return {
      prompt: keepHtml ? front : stripHtml(front),
      answer: keepHtml ? back : stripHtml(back)
    };
  }
}

/**
 * Map media references (numeric IDs to filenames)
 */
function mapMediaNames(refs, mediaIndex) {
  return refs.map(r => {
    const n = Number(r);
    if (Number.isFinite(n) && String(n) === r && mediaIndex[r]) {
      return mediaIndex[r];
    }
    return r;
  });
}

/**
 * Extract media files from zip
 */
async function extractMediaFiles(zip, mediaIndex) {
  const files = new Map(); // filename -> Buffer

  for (const [numStr, filename] of Object.entries(mediaIndex)) {
    const entry = zip.file(numStr);
    if (!entry) continue;

    const data = await entry.async('nodebuffer');
    files.set(filename, data);
  }

  return files;
}

/**
 * Build MoFaCTS stims structure
 */
function buildStims(cards, options = {}) {
  const clusters = [];

  for (const card of cards) {
    // Each Anki card becomes one cluster with one stim
    const stim = {
      response: {
        correctResponse: card.answer
      },
      display: {}
    };

    // Add incorrect responses if available (for future MC support)
    if (card.incorrectResponses && card.incorrectResponses.length > 0) {
      stim.response.incorrectResponses = card.incorrectResponses;
    }

    // Add display text if no images or if text should be shown
    if (!card.hasImage || options.includeTextWithImages) {
      stim.display.text = card.prompt;
    }

    // Add image if present
    if (card.hasImage && card.media.length > 0) {
      // Use first image found
      const imgFile = card.media.find(m => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m));
      if (imgFile) {
        stim.display.imgSrc = imgFile;
      }
    }

    clusters.push({ stims: [stim] });
  }

  return { setspec: { clusters } };
}

/**
 * Build MoFaCTS TDF structure
 */
function buildTDF(deckName, stimFilename, cardCount, options = {}) {
  const lessonName = options.lessonName || `${deckName} (imported from Anki)`;
  const lfparameter = options.lfparameter || '0.85';

  // Standard adaptive learning model formula
  const calculateProbability = 'p.y = -3 + .508* pFunc.logitdec( p.overallOutcomeHistory.slice( Math.max(p.overallOutcomeHistory.length-60,  0),   p.overallOutcomeHistory.length),  .974)+ 1.4 * Math.log(1+p.stimSuccessCount) + 7.98 * pFunc.recency(p.stimSecsSinceLastShown,  .115) ;  var lastElements = p.overallOutcomeHistory.slice(Math.max(p.overallOutcomeHistory.length - 60,  0),  p.overallOutcomeHistory.length); var sum = lastElements.reduce((accumulator,  currentValue) => accumulator + currentValue,  0); var average = sum / (lastElements.length); p.probability = 1.0 / (1.0 + Math.exp(-p.y));  if ( p.overallStudyHistory && p.overallStudyHistory.length % 4 !== 0 && average > p.stimParameters[1] && p.probability > p.stimParameters[1]) {p.probability = 1 / (1 + Math.exp(-(Math.log(p.probability / (1 - p.probability)) + 6)));}  return p\n';

  return {
    tutor: {
      setspec: {
        lessonname: lessonName,
        stimulusfile: stimFilename,
        shuffleclusters: `0-${cardCount - 1}`,
        userselect: 'true',
        lfparameter: lfparameter,
        enableAudioPromptAndFeedback: options.enableAudio ? 'true' : 'false',
        audioInputEnabled: options.enableSpeech ? 'true' : 'false'
      },
      unit: [
        {
          unitname: 'Instructions',
          unitinstructions: options.instructions || `<p>This lesson was imported from an Anki deck.</p><p>Study each card and type your answer when prompted.</p>`
        },
        {
          unitname: 'Practice',
          learningsession: {
            clusterlist: `0-${cardCount - 1}`,
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
}

/**
 * Main conversion function
 * @param {Buffer} apkgBuffer - The .apkg file buffer
 * @param {Object} options - Conversion options
 * @returns {Object} { tdf, stims, mediaFiles, stats }
 *
 * NOTE: Commented out - conversion happens client-side in contentUpload.js
 */
/*
export async function convertApkgToMofacts(apkgBuffer, options = {}) {
  const {
    keepHtml = false,
    includeTextWithImages = false,
    lessonName = null,
    lfparameter = '0.85',
    enableAudio = false,
    enableSpeech = false,
    instructions = null
  } = options;

  // Load zip
  const zip = await JSZip.loadAsync(apkgBuffer);

  // Get collection database
  const db = await getCollectionDb(zip);

  // Get media index
  const mediaIndex = await getMediaIndex(zip);

  // Parse models and decks
  const [modelsRaw, decksRaw] = getModelsAndDecks(db);
  const models = buildModelIndex(modelsRaw);
  const decks = buildDeckIndex(decksRaw);

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

  // Process cards
  const cards = [];
  let primaryDeckName = null;

  for (const row of queryAll(db, 'SELECT id, nid, did, ord FROM cards')) {
    const { id: cid, nid, did, ord } = row;
    const note = notes.get(nid);
    if (!note) continue;

    const model = models.get(note.mid);
    const deckName = decks.get(did) || `Deck_${did}`;
    if (!primaryDeckName) primaryDeckName = deckName;

    const isCloze = model ? model.isCloze : false;
    const { prompt, answer } = extractPromptAnswer(note.fields, isCloze, ord, keepHtml);

    // Extract media
    const mediaRefs = extractMediaRefs(note.fields);
    const mediaNames = mapMediaNames(mediaRefs, mediaIndex);
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

  // Extract media files
  const mediaFiles = await extractMediaFiles(zip, mediaIndex);

  // Build stims
  const stims = buildStims(cards, { includeTextWithImages });

  // Build TDF
  const stimFilename = `${primaryDeckName || 'imported'}_stims.json`;
  const tdf = buildTDF(primaryDeckName || 'Imported Deck', stimFilename, cards.length, {
    lessonName,
    lfparameter,
    enableAudio,
    enableSpeech,
    instructions
  });

  return {
    tdf,
    stims,
    mediaFiles,
    stats: {
      cardCount: cards.length,
      mediaCount: mediaFiles.size,
      deckName: primaryDeckName
    }
  };
}
*/
