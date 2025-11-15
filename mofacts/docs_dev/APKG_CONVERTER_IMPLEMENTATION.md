# Anki .apkg to MoFaCTS Converter - Implementation Guide

**Created:** 2025-01-15
**Status:** Prototype Complete, Ready for Integration
**Purpose:** Convert Anki .apkg deck files to MoFaCTS TDF/stims format

---

## Overview

Successfully implemented and tested an .apkg to MoFaCTS converter that transforms Anki flashcard decks into MoFaCTS-compatible content packages.

### Test Results (US Presidents deck)

```
✓ Input: US_Presidents_w_pics.apkg
✓ Output: 44 cards converted
✓ Media: 44 images extracted
✓ Format: Valid MoFaCTS TDF + stims structure
✓ Files: TDF.json, stims.json, + 44 .jpg files
```

---

## Files Created

### 1. Converter Script
**Location:** [`server/lib/apkgConverter.js`](../server/lib/apkgConverter.js)
- Full-featured converter module
- Supports: Basic cards, Cloze deletions, media extraction
- Handles: collection.anki2, collection.anki21 formats
- Note: Requires zstd package for collection.anki21b (optional)

### 2. Test Script
**Location:** [`scripts/testApkgConverter.js`](../scripts/testApkgConverter.js)
- Standalone test script (no zstd dependency)
- Command-line interface
- Outputs detailed conversion logs

---

## Dependencies

### Required (Already Installed)
```json
{
  "jszip": "^3.x",
  "sql.js": "^1.x"
}
```

### Optional (For newer .apkg formats)
```json
{
  "zstd": "^1.x"  // For collection.anki21b support
}
```

**Installation:**
```bash
npm install jszip sql.js --save --ignore-scripts
```

---

## Usage

### Standalone Test
```bash
node scripts/testApkgConverter.js path/to/deck.apkg output_dir
```

### As Module
```javascript
const { convertApkg } = require('./scripts/testApkgConverter');

const result = await convertApkg(apkgPath, outputDir);
// Returns: { tdfPath, stimsPath, cardCount, mediaCount, deckName }
```

---

## Output Structure

### TDF File (`DeckName_TDF.json`)
```json
{
  "tutor": {
    "setspec": {
      "lessonname": "Deck Name (imported from Anki)",
      "stimulusfile": "DeckName_stims.json",
      "shuffleclusters": "0-N",
      "userselect": "true",
      "lfparameter": "0.85"
    },
    "unit": [
      {
        "unitname": "Instructions",
        "unitinstructions": "<p>Imported from Anki...</p>"
      },
      {
        "unitname": "Practice",
        "learningsession": {
          "clusterlist": "0-N",
          "unitMode": "distance"
        },
        "deliveryparams": {
          "purestudy": "10000",
          "drill": "10000",
          ...
        }
      }
    ]
  }
}
```

### Stims File (`DeckName_stims.json`)
```json
{
  "setspec": {
    "clusters": [
      {
        "stims": [
          {
            "response": {
              "correctResponse": "Answer text"
            },
            "display": {
              "imgSrc": "image.jpg",    // If media present
              "text": "Question text"   // If text present
            }
          }
        ]
      }
    ]
  }
}
```

### Media Files
- Extracted to same directory as JSON files
- Original filenames preserved
- Supported: .jpg, .jpeg, .png, .gif, .webp, .svg
- Audio files: .mp3, .wav, .ogg (extracted but not yet used in display)

---

## Integration Plan

### Phase 1: Server-Side Meteor Method (Recommended)

**Location:** `server/methods.js`

```javascript
Meteor.methods({
  async convertApkgToMofacts(apkgBuffer, options = {}) {
    check(apkgBuffer, Buffer);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }

    // Import converter
    const { convertApkg } = await import('./lib/apkgConverter.js');

    // Create temp directory
    const tempDir = `/tmp/apkg_${Random.id()}`;
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // Convert
      const result = await convertApkg(apkgBuffer, tempDir);

      // Read generated files
      const tdf = JSON.parse(fs.readFileSync(result.tdfPath, 'utf8'));
      const stims = JSON.parse(fs.readFileSync(result.stimsPath, 'utf8'));

      // Extract media files as base64 or upload to DynamicAssets
      const mediaFiles = {};
      for (const filename of fs.readdirSync(tempDir)) {
        if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)) {
          const buffer = fs.readFileSync(path.join(tempDir, filename));
          mediaFiles[filename] = buffer.toString('base64');
        }
      }

      return {
        tdf,
        stims,
        mediaFiles,
        stats: result
      };
    } finally {
      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});
```

### Phase 2: Content Upload UI Integration

**Location:** `client/views/experimentSetup/` (or wherever TDF upload lives)

**Add to Upload Dialog:**

```html
<template name="contentUpload">
  <div class="upload-section">
    <h3>Upload Content</h3>

    <!-- Existing ZIP upload -->
    <div class="upload-option">
      <label>MoFaCTS Package (.zip)</label>
      <input type="file" accept=".zip" id="upload-zip">
    </div>

    <!-- NEW: Anki import -->
    <div class="upload-option">
      <label>Import from Anki (.apkg)</label>
      <input type="file" accept=".apkg" id="upload-apkg">
      <p class="help-text">Convert Anki flashcard decks to MoFaCTS format</p>
    </div>
  </div>
</template>
```

**Client Handler:**

```javascript
Template.contentUpload.events({
  'change #upload-apkg': async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show loading indicator
    Session.set('uploadingApkg', true);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Call server method
      const result = await Meteor.callAsync('convertApkgToMofacts', buffer, {
        lessonName: file.name.replace('.apkg', ''),
        lfparameter: '0.85',
        enableAudio: false,
        enableSpeech: false
      });

      // Now you have:
      // - result.tdf (TDF object)
      // - result.stims (stims object)
      // - result.mediaFiles (map of filename -> base64)

      // Option A: Create package ZIP client-side
      const zip = new JSZip();
      zip.file('TDF.json', JSON.stringify(result.tdf, null, 2));
      zip.file('stims.json', JSON.stringify(result.stims, null, 2));
      for (const [filename, base64] of Object.entries(result.mediaFiles)) {
        zip.file(filename, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });

      // Trigger download or upload to existing package processor
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.stats.deckName}.zip`;
      a.click();

      // Option B: Send to existing processPackageUpload method
      // ... (integrate with existing upload flow)

      alert(`Successfully converted ${result.stats.cardCount} cards!`);

    } catch (error) {
      console.error('Conversion error:', error);
      alert('Failed to convert .apkg file: ' + error.message);
    } finally {
      Session.set('uploadingApkg', false);
    }
  }
});
```

### Phase 3: Direct Upload to MoFaCTS (Advanced)

Instead of generating a downloadable ZIP, directly create the TDF and upload media to DynamicAssets:

```javascript
// Server method continuation...
async convertAndUploadApkg(apkgBuffer, courseId, options) {
  // ... convert as above ...

  // Create TDF document
  const tdfId = await Tdfs.insertAsync({
    owner: this.userId,
    fileName: result.deckName,
    content: result.tdf,
    createdAt: new Date(),
    course: courseId
  });

  // Upload media files to DynamicAssets collection
  for (const [filename, base64] of Object.entries(mediaFiles)) {
    const buffer = Buffer.from(base64, 'base64');

    await DynamicAssets.insertAsync({
      tdfId: tdfId,
      filename: filename,
      data: buffer,
      contentType: mime.lookup(filename),
      uploadedAt: new Date()
    });
  }

  return { tdfId, cardCount: result.stats.cardCount };
}
```

---

## Conversion Details

### Supported Anki Features

**✓ Supported:**
- Basic cards (front/back)
- Cloze deletions
- Images (jpg, png, gif, webp, svg)
- Multiple decks in one .apkg
- Tags (preserved in output)
- HTML formatting (stripped or preserved based on options)

**✗ Not Yet Supported:**
- Audio playback in display
- LaTeX/MathJax formulas
- Conditional formatting
- Filtered decks
- Custom card templates beyond Basic/Cloze

### Field Mapping

| Anki Field | MoFaCTS Mapping |
|------------|-----------------|
| Front (Basic) | `display.text` and/or `display.imgSrc` |
| Back (Basic) | `response.correctResponse` |
| Cloze text | Masked for prompt, answer extracted |
| Media refs | `display.imgSrc` |
| Tags | Preserved (not currently used in TDF) |

### Card Type Handling

**Basic Cards:**
```
Anki: Front="Question", Back="Answer"
→ MoFaCTS: prompt="Question", answer="Answer"
```

**Cloze Cards:**
```
Anki: "The capital of {{c1::France}} is {{c1::Paris}}"
→ Card 1: prompt="The capital of [...] is [...]", answer="France; Paris"
```

**Image Cards:**
```
Anki: Front="<img src='01.jpg'>", Back="Answer"
→ MoFaCTS: display.imgSrc="01.jpg", answer="Answer"
```

---

## Configuration Options

### Converter Options

```javascript
const options = {
  keepHtml: false,              // Preserve HTML tags (default: strip)
  includeTextWithImages: true,  // Show text even when image present
  lessonName: null,             // Override lesson name
  lfparameter: '0.85',          // Learning factor
  enableAudio: false,           // Enable TTS
  enableSpeech: false,          // Enable speech recognition
  instructions: null            // Custom instructions HTML
};
```

---

## Testing

### Manual Test
```bash
cd mofacts/
node scripts/testApkgConverter.js \
  "C:\path\to\deck.apkg" \
  test_output
```

### Automated Test (Future)
```javascript
// In server/methods.test.js
describe('convertApkgToMofacts', () => {
  it('should convert US Presidents deck', async () => {
    const buffer = fs.readFileSync('test_data/US_Presidents_w_pics.apkg');
    const result = await convertApkg(buffer, '/tmp/test');

    assert.equal(result.cardCount, 44);
    assert.equal(result.mediaCount, 44);
    assert.equal(result.deckName, 'U.S. Presidents (pics)');
  });
});
```

---

## Next Steps

### Immediate (Ready to Use)
1. ✓ Core converter implemented
2. ✓ Tested with sample .apkg file
3. ✓ Output validated against MoFaCTS schema

### Integration (Next)
1. Add Meteor method to `server/methods.js`
2. Add UI control to Content Upload dialog
3. Wire up to existing package upload flow
4. Test end-to-end workflow

### Enhancements (Future)
1. Support for audio files in display
2. LaTeX/MathJax rendering
3. Multiple choice question generation from Anki MC cards
4. Preserve deck hierarchy (subdeck → units)
5. Import scheduling data (due dates → difficulty)
6. Batch conversion (multiple .apkg files)

---

## Known Limitations

1. **Zstd Format:** Newer Anki versions use .anki21b (zstd compressed). Current implementation supports .anki2 and .anki21 (uncompressed). To support .anki21b, install zstd package and update decompression logic.

2. **Cloze Cards:** Simplified handling. Complex cloze patterns (multiple deletions, hints) may not render perfectly.

3. **Audio:** Audio files are extracted but not yet integrated into MoFaCTS display logic.

4. **Templates:** Custom Anki card templates beyond Basic/Cloze are not supported.

5. **Deck Hierarchy:** Subdeck structure is flattened to single deck.

---

## Example Output

See [test_output/](../test_output/) for full example from US Presidents deck:
- `U.S. Presidents (pics)_TDF.json` - MoFaCTS TDF file
- `U.S. Presidents (pics)_stims.json` - Stims definition
- `01.jpg` through `44.jpg` - President portrait images

---

## References

- **Anki Format:** https://github.com/ankitects/anki/blob/main/docs/manual.md
- **MoFaCTS TDF Schema:** See [CLAUDE.md](../CLAUDE.md#collections-data-model)
- **Existing Upload Flow:** [server/methods.js:processPackageUpload](../server/methods.js)

---

**Status:** ✓ Ready for integration
**Next:** Add Meteor method + UI integration
