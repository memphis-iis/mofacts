# Anki .apkg Upload Integration - Complete

**Created:** 2025-01-15
**Status:** ✅ Integrated into Content Upload UI
**Purpose:** Enable direct .apkg file uploads that convert to MoFaCTS format

---

## Summary

Successfully integrated Anki .apkg conversion directly into the MoFaCTS Content Upload interface. Users can now upload .apkg files which are automatically converted to MoFaCTS format and processed through the existing package upload pipeline.

---

## Changes Made

### 1. UI Updates ([contentUpload.html](../client/views/experimentSetup/contentUpload.html))

**Reorganized Upload Sections:**
- ✅ Moved ZIP upload above the asset table (lines 10-32)
- ✅ Added new .apkg upload section (lines 34-56)
- ✅ Removed duplicate upload section

**New .apkg Upload Section:**
```html
<!-- Upload from Anki (.apkg) Section -->
<div class="admin-section">
    <h4 class="text-center">Import from Anki (.apkg)</h4>
    <p class="text-center">
        Convert Anki flashcard decks to MoFaCTS format.
        Supports images, cloze deletions, and basic cards.
    </p>
    <input type="file" id="upload-apkg" accept=".apkg">
    <div id="apkg-status" style="display:none;">
        <span class="fa fa-spinner fa-spin"></span> Converting...
    </div>
</div>
```

### 2. Client-Side Conversion Logic ([contentUpload.js](../client/views/experimentSetup/contentUpload.js))

**Added Event Handler (lines 202-344):**
```javascript
'change #upload-apkg': async function(event) {
  // 1. Load .apkg file
  // 2. Extract SQLite database and media
  // 3. Convert to TDF/stims with adaptive model
  // 4. Create ZIP file
  // 5. Upload through doPackageUpload()
}
```

**Added Helper Functions (lines 723-846):**
- `stripHtml()` - Remove HTML tags
- `splitFields()` - Parse Anki field separator
- `extractMediaRefs()` - Find image/audio references
- `queryAll()` - Execute SQLite queries
- `convertApkgData()` - Main conversion logic

---

## Conversion Flow

```
User selects .apkg file
    ↓
Read file with FileReader API
    ↓
Load with JSZip
    ↓
Extract collection.anki2/anki21 (SQLite)
    ↓
Parse with sql.js
    ↓
Query notes, cards, decks
    ↓
Build TDF structure with:
  - calculateProbability formula ✓
  - optimalThreshold: .8 ✓
  - Adaptive learning params ✓
    ↓
Build stims structure
    ↓
Create new ZIP with:
  - DeckName_TDF.json
  - DeckName_stims.json
  - Media files (images)
    ↓
Pass to doPackageUpload()
    ↓
Normal MoFaCTS package processing
```

---

## Features Included

### ✅ Adaptive Learning Model
Every converted .apkg includes the standard MoFaCTS adaptive model:
```javascript
calculateProbability: "p.y = -3 + .508* pFunc.logitdec(...)"
```

### ✅ Optimal Threshold
Target accuracy set to 80%:
```javascript
optimalThreshold: ".8"
```

### ✅ Supported Anki Features
- Basic cards (front/back)
- Cloze deletions (simplified)
- Images (jpg, png, gif, webp, svg)
- Multiple decks
- Media files

### ✅ User Experience
- Loading indicator during conversion
- Error messages with details
- Automatic upload after conversion
- Integration with existing email notification toggle

---

## Dependencies

### Already Installed
```json
{
  "jszip": "^3.x",    // For reading .apkg and creating output ZIP
  "sql.js": "^1.x"    // For parsing Anki SQLite database
}
```

Installed via:
```bash
npm install jszip sql.js --save --ignore-scripts
```

---

## Usage

### For Users

1. Navigate to **Content Management** page
2. Scroll to **Import from Anki (.apkg)** section
3. Click file input and select your .apkg file
4. Wait for conversion (spinner appears)
5. Package uploads automatically
6. Receive success/error alert

### For Developers

**Client-side conversion:**
```javascript
// Triggered by file input change
'change #upload-apkg': async function(event) {
  const file = event.target.files[0];

  // Convert .apkg → ZIP
  const zipFile = await convertApkgToZip(file);

  // Upload through normal flow
  await doPackageUpload(zipFile, template);
}
```

**Dependencies loaded dynamically:**
```javascript
const JSZip = (await import('jszip')).default;
const initSqlJs = (await import('sql.js')).default;
```

---

## Testing

### Manual Test (Already Performed)
```bash
cd "mofacts_config"
node "../mofacts/mofacts/scripts/testApkgConverter.js" \
  "US_Presidents_w_pics.apkg" \
  "US_Presidents_MoFaCTS"
```

**Result:**
- ✅ 44 cards converted
- ✅ 44 images extracted
- ✅ TDF includes adaptive model
- ✅ TDF includes optimalThreshold
- ✅ Valid MoFaCTS format

### Browser Test (Recommended Next)
1. Start MoFaCTS dev server
2. Login as teacher/admin
3. Navigate to Content Management
4. Upload `US_Presidents_w_pics.apkg`
5. Verify:
   - Conversion completes without errors
   - Package appears in asset table
   - TDF and stims are created correctly
   - Images are accessible
   - Lesson is playable

---

## File Locations

### Modified Files
```
client/views/experimentSetup/
├── contentUpload.html    # Added .apkg upload UI
└── contentUpload.js      # Added conversion logic

scripts/
└── testApkgConverter.js  # Standalone test script (updated)

server/lib/
└── apkgConverter.js      # Server module (for future use)

docs_dev/
├── APKG_CONVERTER_IMPLEMENTATION.md
└── APKG_UPLOAD_INTEGRATION.md (this file)
```

### Output Example
```
mofacts_config/US_Presidents_MoFaCTS/
├── U.S. Presidents (pics)_TDF.json
├── U.S. Presidents (pics)_stims.json
├── 01.jpg
├── 02.jpg
... (44 images total)
```

---

## Known Limitations

1. **Zstd Format:** Newer .anki21b files (zstd compressed) not yet supported
2. **Cloze Cards:** Simplified handling - may not perfectly preserve complex cloze patterns
3. **Audio Files:** Extracted but not yet integrated into display
4. **Custom Templates:** Only Basic and Cloze templates supported

---

## Future Enhancements

### Short Term
- [ ] Add progress bar for conversion
- [ ] Show preview of converted cards before upload
- [ ] Allow editing lesson name/instructions before upload
- [ ] Support for .anki21b (zstd) format

### Long Term
- [ ] Audio file playback in MoFaCTS
- [ ] LaTeX/MathJax support
- [ ] Multiple choice from incorrect answers
- [ ] Preserve deck hierarchy as units
- [ ] Batch conversion (multiple .apkg files)

---

## Troubleshooting

### Error: "No collection database found"
**Cause:** Very old or corrupted .apkg file
**Solution:** Open in Anki and re-export

### Error: "Failed to convert .apkg file"
**Check:**
- File is valid .apkg (not renamed .zip)
- jszip/sql.js are installed
- Browser console for detailed error

### Conversion succeeds but upload fails
**Cause:** Generated ZIP doesn't match expected format
**Solution:** Check TDF/stims structure in console logs

### Images don't appear in lesson
**Cause:** Media files not extracted or uploaded
**Check:**
- Media index in .apkg
- ZIP includes all referenced images
- DynamicAssets has the files

---

## Testing Checklist

- [x] Standalone converter works (US Presidents deck)
- [x] TDF includes calculateProbability
- [x] TDF includes optimalThreshold: ".8"
- [x] Images extracted correctly
- [ ] UI shows .apkg upload section
- [ ] File input accepts .apkg files
- [ ] Conversion spinner appears
- [ ] ZIP created correctly
- [ ] Upload through normal process works
- [ ] Package appears in asset table
- [ ] Lesson is playable
- [ ] Images display in cards
- [ ] Error handling works

---

## Code References

### Conversion Entry Point
[contentUpload.js:203-344](../client/views/experimentSetup/contentUpload.js#L203-L344)

### Helper Functions
[contentUpload.js:723-846](../client/views/experimentSetup/contentUpload.js#L723-L846)

### UI Section
[contentUpload.html:34-56](../client/views/experimentSetup/contentUpload.html#L34-L56)

### Test Script
[scripts/testApkgConverter.js](../scripts/testApkgConverter.js)

---

## Example Output TDF

```json
{
  "tutor": {
    "setspec": {
      "lessonname": "U.S. Presidents (pics) (imported from Anki)",
      "stimulusfile": "U.S. Presidents (pics)_stims.json",
      "shuffleclusters": "0-43",
      "userselect": "true",
      "lfparameter": "0.85"
    },
    "unit": [
      {
        "unitname": "Instructions",
        "unitinstructions": "<p>This lesson was imported from an Anki deck...</p>"
      },
      {
        "unitname": "Practice",
        "learningsession": {
          "clusterlist": "0-43",
          "unitMode": "distance",
          "calculateProbability": "p.y = -3 + .508* pFunc.logitdec(...)..."
        },
        "deliveryparams": {
          "optimalThreshold": ".8",
          "purestudy": "10000",
          "drill": "10000",
          ...
        }
      }
    ]
  }
}
```

---

## Next Steps

1. **Test in Browser**
   - Start dev server
   - Upload US_Presidents_w_pics.apkg
   - Verify complete flow

2. **Refine UI/UX**
   - Add conversion progress details
   - Show card count before upload
   - Allow customization options

3. **Documentation**
   - Update user docs with .apkg import instructions
   - Create video tutorial
   - Add FAQ section

4. **Performance**
   - Consider server-side conversion for large decks
   - Add file size limits
   - Optimize media processing

---

**Status:** ✅ Ready for testing in development environment

**Test with:** `US_Presidents_w_pics.apkg` (44 cards, 44 images)

**Expected result:** Fully functional MoFaCTS lesson with adaptive learning
