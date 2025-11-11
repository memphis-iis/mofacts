# Responsive Images Implementation Plan
**Date:** 2025-01-11
**Status:** Phase 2 Enhancement (Not Yet Implemented)
**Estimated Effort:** 8-12 hours
**Priority:** Medium (Mobile bandwidth optimization)

---

## Overview

**Goal:** Implement responsive images with `srcset` and `sizes` attributes to serve appropriately-sized images based on device viewport, reducing mobile bandwidth usage by 50-70%.

**Current State:**
- Images served from DynamicAssets (ostrio:files)
- Single size per image (uploaded from TDF packages)
- Desktop-sized images downloaded by mobile users
- Average waste: 2-3x bandwidth on mobile

**Target State:**
- Multiple image sizes generated on upload (320w, 640w, 1024w)
- Browser selects appropriate size based on viewport
- `srcset` and `sizes` attributes on all `<img>` tags
- Mobile users download 50-70% smaller files

---

## Current Image System Architecture

### Upload Flow
```
TDF Package (ZIP) → Server Method → Extract Assets → DynamicAssets Collection
```

**Key Files:**
- `common/Collections.js:32-67` - DynamicAssets FilesCollection configuration
- `server/methods.js:processPackageUpload` - ZIP extraction logic
- `client/views/experiment/card.js:1727-1780` - Image preloading
- `client/views/experiment/card.html:116-124` - Image rendering

### Storage
- **Location:** `process.env.HOME + '/dynamic-assets'` (or `/mofactsAssets` in Docker)
- **Format:** Original files as uploaded (no processing)
- **Serving:** Via ostrio:files `asset.link()` method
- **Constraints:** Only ZIP files allowed (line Collections.js:61)

---

## Implementation Phases

### Phase 1: Server-Side Image Processing (4-6 hours)

#### 1.1 Add Image Processing Library
**Install Sharp** (recommended over ImageMagick for Node.js)

```bash
cd mofacts/
meteor npm install --save sharp
```

**Why Sharp:**
- Fast (4-5x faster than ImageMagick)
- No external dependencies
- Excellent WebP/AVIF support
- Low memory usage

#### 1.2 Create Image Resize Module
**New file:** `server/lib/imageProcessor.js`

```javascript
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Target image widths for responsive images
const IMAGE_WIDTHS = [320, 640, 1024];
const IMAGE_FORMATS = ['webp', 'jpg']; // Generate both formats

/**
 * Generate responsive image variants for a given image file
 * @param {string} originalPath - Path to original image
 * @param {string} outputDir - Directory to save variants
 * @param {string} basename - Base filename (without extension)
 * @returns {Promise<Object>} - Map of width → file paths
 */
export async function generateImageVariants(originalPath, outputDir, basename) {
  const variants = {};

  // Get original image metadata
  const metadata = await sharp(originalPath).metadata();
  console.log(`[ImageProcessor] Processing ${basename}: ${metadata.width}x${metadata.height}`);

  for (const width of IMAGE_WIDTHS) {
    // Skip if original is smaller than target width
    if (metadata.width < width) {
      console.log(`[ImageProcessor] Skipping ${width}w (original is ${metadata.width}w)`);
      continue;
    }

    for (const format of IMAGE_FORMATS) {
      const outputFilename = `${basename}-${width}w.${format}`;
      const outputPath = path.join(outputDir, outputFilename);

      try {
        await sharp(originalPath)
          .resize(width, null, { withoutEnlargement: true })
          .toFormat(format, { quality: 85 })
          .toFile(outputPath);

        if (!variants[width]) variants[width] = {};
        variants[width][format] = outputFilename;

        console.log(`[ImageProcessor] ✓ Generated ${outputFilename}`);
      } catch (err) {
        console.error(`[ImageProcessor] ✗ Failed to generate ${outputFilename}:`, err);
      }
    }
  }

  return variants;
}

/**
 * Check if a file is an image based on extension
 */
export function isImageFile(filename) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const ext = path.extname(filename).toLowerCase();
  return imageExtensions.includes(ext);
}
```

#### 1.3 Modify Package Upload Logic
**File:** `server/methods.js` (around line 2833, processPackageUpload method)

**Current behavior:**
- Extract ZIP → Save files to DynamicAssets → Done

**New behavior:**
- Extract ZIP → **Check if file is image** → Generate variants → Save original + variants → Done

**Pseudocode:**
```javascript
// After extracting file from ZIP
if (isImageFile(filename)) {
  // Generate variants (320w, 640w, 1024w in JPG and WebP)
  const variants = await generateImageVariants(filePath, outputDir, basename);

  // Store variant metadata in new collection
  await ImageVariants.insertAsync({
    originalName: filename,
    originalPath: asset.link(),
    variants: variants,
    createdAt: new Date()
  });
}
```

#### 1.4 Create ImageVariants Collection
**File:** `common/Collections.js`

```javascript
// Add after DynamicAssets
ImageVariants = new Mongo.Collection('image_variants');

// Schema:
// {
//   originalName: 'brain-diagram.jpg',
//   originalPath: '/mofactsAssets/assets/brain-diagram.jpg',
//   variants: {
//     320: { jpg: 'brain-diagram-320w.jpg', webp: 'brain-diagram-320w.webp' },
//     640: { jpg: 'brain-diagram-640w.jpg', webp: 'brain-diagram-640w.webp' },
//     1024: { jpg: 'brain-diagram-1024w.jpg', webp: 'brain-diagram-1024w.webp' }
//   },
//   createdAt: ISODate('2025-01-11T...')
// }
```

---

### Phase 2: Client-Side Rendering (2-3 hours)

#### 2.1 Update Helper Functions
**File:** `client/views/experiment/card.js` (lines 1006-1032)

**Current helpers:**
- `curImgSrc()` - Returns single image URL
- `curImgWidth()` - Returns original width
- `curImgHeight()` - Returns original height

**New helpers to add:**
```javascript
'curImgSrcset': function() {
  const currentDisplay = cardState.get('currentDisplay');
  const curImgSrc = currentDisplay ? currentDisplay.imgSrc : undefined;
  if (!curImgSrc) return '';

  // Look up variants from server-side reactive variable or subscription
  const variants = ImageVariantsData.get(curImgSrc);
  if (!variants) return ''; // Fallback to src attribute

  // Build srcset string
  const srcsetParts = [];
  Object.keys(variants).sort((a, b) => a - b).forEach(width => {
    const webp = variants[width].webp;
    const jpg = variants[width].jpg;
    if (webp) srcsetParts.push(`${webp} ${width}w`);
    if (jpg) srcsetParts.push(`${jpg} ${width}w`);
  });

  return srcsetParts.join(', ');
},

'curImgSizes': function() {
  // Tell browser how to select from srcset based on viewport
  // This matches CSS breakpoints (768px, 1024px)
  return '(max-width: 768px) 90vw, (max-width: 1024px) 50vw, 400px';
}
```

#### 2.2 Update Template
**File:** `client/views/experiment/card.html` (lines 116-124)

**Current:**
```html
<img src="{{curImgSrc}}"
     width="{{curImgWidth}}"
     height="{{curImgHeight}}"
     loading="eager"
     fetchpriority="high"
     decoding="async"
     class="img-responsive stimulus-image"
     alt="Learning stimulus image">
```

**New (with responsive images):**
```html
<picture>
  <!-- WebP sources for browsers that support it -->
  {{#if curImgSrcsetWebP}}
  <source type="image/webp"
          srcset="{{curImgSrcsetWebP}}"
          sizes="{{curImgSizes}}">
  {{/if}}

  <!-- Fallback JPG sources -->
  <img src="{{curImgSrc}}"
       {{#if curImgSrcsetJPG}}
       srcset="{{curImgSrcsetJPG}}"
       sizes="{{curImgSizes}}"
       {{/if}}
       width="{{curImgWidth}}"
       height="{{curImgHeight}}"
       loading="eager"
       fetchpriority="high"
       decoding="async"
       class="img-responsive stimulus-image"
       alt="Learning stimulus image">
</picture>
```

---

### Phase 3: Subscription & Caching (1-2 hours)

#### 3.1 Create Publication
**File:** `server/publications.js`

```javascript
Meteor.publish('imageVariants', function(tdfId) {
  if (!this.userId) {
    return this.ready();
  }

  // Get all image filenames used in this TDF
  const tdf = Tdfs.findOne({_id: tdfId});
  if (!tdf) return this.ready();

  const imageNames = extractImageNamesFromTdf(tdf); // Helper function

  return ImageVariants.find({
    originalName: { $in: imageNames }
  });
});
```

#### 3.2 Subscribe on Client
**File:** `client/views/experiment/card.js` (in Template.card.onCreated)

```javascript
Template.card.onCreated(function() {
  const template = this;

  // Subscribe to image variants for current TDF
  template.autorun(function() {
    const tdfId = Session.get('currentTdfId');
    if (tdfId) {
      template.subscribe('imageVariants', tdfId);
    }
  });

  // ... rest of onCreated
});
```

---

## Testing Plan

### Unit Tests
1. **Image processing:**
   - Generate 320w, 640w, 1024w from 2000x1500px source
   - Skip generation if original < target width
   - Handle corrupted images gracefully

2. **Srcset generation:**
   - Verify srcset string format
   - Verify sizes attribute matches CSS

### Integration Tests
1. **Upload workflow:**
   - Upload TDF package with images
   - Verify variants generated
   - Verify ImageVariants collection updated

2. **Rendering:**
   - Load card with image
   - Verify `<picture>` element rendered
   - Verify srcset attributes present

### Manual Testing (Mobile)
1. **Device testing:**
   - iPhone (320-428px width) → Should load 320w or 640w
   - iPad (768-1024px width) → Should load 640w or 1024w
   - Desktop (1200px+ width) → Should load 1024w or original

2. **Network inspection:**
   - Chrome DevTools → Network tab
   - Throttle to "Slow 3G"
   - Verify correct image size downloaded
   - Verify WebP served to supporting browsers

3. **Performance:**
   - Lighthouse audit (mobile)
   - Check LCP (Largest Contentful Paint)
   - Should improve by 30-50% for image-heavy TDFs

---

## Rollout Strategy

### Option A: Gradual Migration (Recommended)
1. **Week 1:** Deploy image processing (generates variants for new uploads)
2. **Week 2:** Deploy client rendering (falls back to original if no variants)
3. **Week 3:** Backfill existing images (run migration script)

**Advantage:** No breaking changes, graceful fallback

### Option B: All-at-Once
1. Deploy server + client changes together
2. Run migration for all existing images
3. Test thoroughly on staging first

**Risk:** Higher chance of breaking changes

---

## Migration Script (Backfill Existing Images)

**File:** `server/migrations/backfillImageVariants.js`

```javascript
import { generateImageVariants, isImageFile } from '../lib/imageProcessor';

Meteor.startup(async function() {
  // Only run if --settings includes "runImageMigration": true
  if (!Meteor.settings.runImageMigration) return;

  console.log('[Migration] Starting image variants backfill...');

  const assets = DynamicAssets.find().fetch();
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const asset of assets) {
    const filename = asset.name;

    if (!isImageFile(filename)) {
      skipped++;
      continue;
    }

    // Check if variants already exist
    const existing = await ImageVariants.findOneAsync({ originalName: filename });
    if (existing) {
      console.log(`[Migration] Skipping ${filename} (already processed)`);
      skipped++;
      continue;
    }

    try {
      const filePath = asset.path; // Full filesystem path
      const outputDir = path.dirname(filePath);
      const basename = path.basename(filename, path.extname(filename));

      const variants = await generateImageVariants(filePath, outputDir, basename);

      await ImageVariants.insertAsync({
        originalName: filename,
        originalPath: asset.link(),
        variants: variants,
        createdAt: new Date()
      });

      processed++;
      console.log(`[Migration] ✓ Processed ${filename} (${processed}/${assets.length})`);
    } catch (err) {
      errors++;
      console.error(`[Migration] ✗ Failed to process ${filename}:`, err);
    }
  }

  console.log(`[Migration] Complete: ${processed} processed, ${skipped} skipped, ${errors} errors`);
});
```

**Run with:**
```bash
meteor run --settings settings-migration.json
```

**settings-migration.json:**
```json
{
  "runImageMigration": true,
  ...other settings...
}
```

---

## Performance Impact

### Before (Current State)
- **iPhone 12 (390x844px)**
  - Downloads: 1024x768px image (150 KB)
  - Load time: ~1.2s on 3G

### After (With Responsive Images)
- **iPhone 12 (390x844px)**
  - Downloads: 640x480px WebP image (35 KB)
  - Load time: ~0.3s on 3G
  - **Savings: 77% bandwidth, 75% faster**

### Network Savings (Per Image)
- **Mobile (320-640px):** 60-80% reduction
- **Tablet (768-1024px):** 40-60% reduction
- **Desktop (1200px+):** 0-20% reduction (already optimal)

### Overall Impact
- **Average TDF with 10 images:** 1-2 MB → 300-500 KB (mobile)
- **User experience:** Faster page loads, less data usage

---

## Browser Support

### srcset/sizes
- **Support:** 97.5% (all modern browsers)
- **Fallback:** src attribute (works everywhere)

### WebP
- **Support:** 96% (Chrome, Firefox, Edge, Safari 14+)
- **Fallback:** JPG (works everywhere)

### AVIF (Optional Future Enhancement)
- **Support:** 85% (Chrome, Firefox, Opera)
- **Fallback:** WebP or JPG

---

## Cost Analysis

### Development Time
- **Phase 1:** 4-6 hours (server processing)
- **Phase 2:** 2-3 hours (client rendering)
- **Phase 3:** 1-2 hours (subscription/caching)
- **Testing:** 1-2 hours
- **Migration:** 1 hour
- **Total:** 9-14 hours

### Storage Impact
- **3 sizes × 2 formats = 6 files per image**
- **Average size per image set:**
  - Original: 150 KB
  - Variants: 35 KB + 60 KB + 100 KB + WebP versions = ~200 KB total
  - **Total per image:** 350 KB (2.3x original)

### Infrastructure
- **Disk space:** 2-3x current usage
- **CPU:** Minimal (only during upload)
- **RAM:** Minimal (Sharp is memory-efficient)

---

## Alternatives Considered

### 1. CDN-based Image Processing (Cloudflare, Imgix)
**Pros:**
- No server code changes
- Automatic optimization
- Global CDN caching

**Cons:**
- Monthly cost ($10-50/month)
- Requires public image URLs
- Dependency on external service

**Decision:** Not suitable for MoFaCTS (self-hosted, private images)

### 2. Client-Side Resizing
**Pros:**
- No server changes

**Cons:**
- Still downloads large images (defeats purpose)
- Extra client-side processing

**Decision:** Not viable (doesn't save bandwidth)

### 3. Lazy Generation (On-Demand)
**Pros:**
- No upfront processing
- Storage only for requested sizes

**Cons:**
- First-load latency
- Complex caching logic

**Decision:** Defer to Phase 4 (optimization)

---

## Future Enhancements (Phase 4+)

### 1. AVIF Format Support
- 30% smaller than WebP
- 50% smaller than JPG
- Growing browser support (85%)

### 2. Automatic Quality Optimization
- Adjust quality based on image content
- Use perceptual metrics (SSIM, Butteraugli)

### 3. Lazy Loading for Below-Fold Images
- Change `loading="eager"` → `loading="lazy"` for non-critical images

### 4. Progressive JPEGs
- Display low-quality placeholder → Progressive enhancement
- Better perceived performance

---

## Dependencies

### NPM Packages
```json
{
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

### Meteor Packages
- `ostrio:files` (already installed)

### System Requirements
- No external dependencies (Sharp is pure Node.js)

---

## Documentation Updates Required

1. **CLAUDE.md** - Add responsive images section
2. **README.md** - Update deployment requirements
3. **TDF Creation Guide** - Recommend optimal image sizes (1024-2000px width)
4. **Admin Guide** - Document migration process

---

## Rollback Plan

If issues arise:

1. **Disable client rendering:**
   ```javascript
   // In card.js, temporarily disable srcset helpers
   'curImgSrcset': () => '', // Return empty string
   'curImgSizes': () => ''   // Return empty string
   ```

2. **Revert template changes:**
   - Remove `<picture>` element
   - Restore original `<img>` tag

3. **Server continues generating variants:**
   - No harm (just extra storage)
   - Can be cleaned up later

---

## Success Metrics

### Performance
- [ ] Mobile LCP improves by 30-50%
- [ ] First Contentful Paint improves by 20-30%
- [ ] Lighthouse mobile score increases by 5-10 points

### Bandwidth
- [ ] Mobile users download 50-70% smaller images
- [ ] Overall data usage reduces by 30-40% (for image-heavy TDFs)

### User Experience
- [ ] No visual regressions (images render correctly)
- [ ] No layout shifts (CLS remains < 0.1)
- [ ] Faster perceived load times

---

## Questions & Decisions

### Q1: What image widths should we target?
**Decision:** 320w, 640w, 1024w (covers mobile, tablet, desktop)

### Q2: Should we generate WebP and JPG?
**Decision:** Yes (WebP for modern browsers, JPG for fallback)

### Q3: Should we process existing images?
**Decision:** Yes, via migration script (run once after deployment)

### Q4: What quality setting?
**Decision:** 85% (good balance of quality and size)

### Q5: Should we delete originals after generating variants?
**Decision:** No (keep originals for future reprocessing if needed)

---

## Conclusion

Implementing responsive images is a **medium-priority enhancement** that will significantly improve mobile performance (50-70% bandwidth reduction) at the cost of 2-3x storage and 9-14 hours development time.

**Recommendation:** Implement in Q1 2025 after current mobile optimizations are complete and tested.

**Next Steps:**
1. Review this plan with team
2. Approve storage increase (2-3x disk space)
3. Schedule implementation (2-week sprint)
4. Test on staging environment
5. Deploy to production with rollback plan ready

---

**Document Status:** Draft for Review
**Author:** Mobile Optimization Team
**Last Updated:** 2025-01-11
