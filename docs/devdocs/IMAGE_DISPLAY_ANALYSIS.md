# Image Display Bug Analysis

## Problem
Images are showing "Image Display" alt text instead of actual images.

## Image Display Flow

### 1. HTML Template (card.html:113-119)
```html
{{#if imageCard}}
<div class="h2 vh-50" id="imageDisplay">
    <div class="w-100 text-center">
        <img src="{{curImgSrc}}" width="{{curImgWidth}}" height="{{curImgHeight}}"
             class="img-responsive stimulus-image" alt="Image display">
    </div>
</div>
{{/if}}
```
- Shows image if `imageCard` helper returns true
- `src` comes from `curImgSrc` helper
- If `curImgSrc` is empty, alt text "Image display" shows

### 2. Helpers (card.js)

#### imageCard helper (line 888-891)
```javascript
'imageCard': function() {
  const currentDisplay = Session.get('currentDisplay');
  return !!currentDisplay && !!currentDisplay.imgSrc;
}
```
**KEY**: Checks for `currentDisplay.imgSrc` field

#### curImgSrc helper (line 805-815)
```javascript
'curImgSrc': function() {
  const currentDisplay = Session.get('currentDisplay');
  const curImgSrc = currentDisplay ? currentDisplay.imgSrc : undefined;
  if (curImgSrc && imagesDict[curImgSrc]) {
    return imagesDict[curImgSrc].src;
  } else {
    return '';
  }
}
```
**KEY**: Also looks for `currentDisplay.imgSrc`, then looks up in `imagesDict`

### 3. Image Preloading (card.js:1486-1528)

#### preloadImages function (line 1486)
```javascript
function preloadImages() {
  const curStimImgSrcs = getCurrentStimDisplaySources('imageStimulus');
  imagesDict = {};
  const imageLoadPromises = [];
  for (let src of curStimImgSrcs) {
    // ... loads images ...
    imagesDict[src] = img;
  }
  return Promise.all(imageLoadPromises);
}
```
**KEY**: Uses `getCurrentStimDisplaySources('imageStimulus')` to get image sources

#### getCurrentStimDisplaySources (line 1530-1540)
```javascript
function getCurrentStimDisplaySources(filterPropertyName='clozeStimulus') {
  const displaySrcs = [];
  const stims = Session.get('currentStimuliSet');
  for (const stim of stims) {
    if (stim[filterPropertyName]) {
      displaySrcs.push(stim[filterPropertyName]);
    }
  }
  return displaySrcs;
}
```
**KEY**: Extracts the specified property from each stimulus

### 4. Current Display Setting (card.js:3407)
```javascript
Session.set('currentDisplay', currentDisplayEngine);
```
Where `currentDisplayEngine` comes from:
```javascript
const currentDisplayEngine = Session.get('currentExperimentState').currentDisplayEngine;
```

## Possible Causes

### Cause 1: Field Name Mismatch ⚠️
- `preloadImages()` indexes by `imageStimulus` property
- But helpers look for `imgSrc` property
- If `currentDisplayEngine` has `imageStimulus` instead of `imgSrc`, lookup fails

### Cause 2: imagesDict Not Populated
- `preloadImages()` might not be called before images needed
- OR might fail silently (has error handlers that resolve anyway)
- Check: Is `preloadImages()` being called at all?

### Cause 3: currentDisplay Not Set
- `currentDisplay` might be undefined/null
- `imageCard` would return false, section wouldn't render
- BUT user says "Image Display" shows, so this is NOT the cause

### Cause 4: Wrong Key in imagesDict
- Image loaded with key "filename.png"
- But `currentDisplay.imgSrc` has different value (path, URL, etc.)
- Dictionary lookup fails

### Cause 5: Recent Code Changes
- cleanupTrialContent() clears elements - could be clearing at wrong time
- Session.set('currentDisplay') timing changes
- displayReady transitions might affect when helpers run

## Investigation Steps

1. ✅ Add debug logging to `curImgSrc` helper (DONE)
2. Check what `currentDisplay` actually contains
3. Check what keys exist in `imagesDict`
4. Compare field names: `imgSrc` vs `imageStimulus`
5. Check git history for when this last worked
6. Check if `preloadImages()` is being called

## Questions to Answer
- What properties does `currentDisplayEngine` have?
- Does it have `imgSrc` or `imageStimulus` or both?
- When did this last work?
- What TDFs/stimuli are affected?
