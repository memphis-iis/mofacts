(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/bojicas:howler2/before.js                                                                              //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
exports = {};                                                                                                      // 1
                                                                                                                   // 2
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/bojicas:howler2/vendor/src/howler.core.js                                                              //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
/*!                                                                                                                // 1
 *  howler.js v2.0.0-beta5                                                                                         // 2
 *  howlerjs.com                                                                                                   // 3
 *                                                                                                                 // 4
 *  (c) 2013-2015, James Simpson of GoldFire Studios                                                               // 5
 *  goldfirestudios.com                                                                                            // 6
 *                                                                                                                 // 7
 *  MIT License                                                                                                    // 8
 */                                                                                                                // 9
                                                                                                                   // 10
(function() {                                                                                                      // 11
                                                                                                                   // 12
  'use strict';                                                                                                    // 13
                                                                                                                   // 14
  // Setup our audio context.                                                                                      // 15
  var ctx = null;                                                                                                  // 16
  var usingWebAudio = true;                                                                                        // 17
  var noAudio = false;                                                                                             // 18
  var masterGain = null;                                                                                           // 19
  var canPlayEvent = 'canplaythrough';                                                                             // 20
  setupAudioContext();                                                                                             // 21
                                                                                                                   // 22
  /** Global Methods **/                                                                                           // 23
  /***************************************************************************/                                    // 24
                                                                                                                   // 25
  /**                                                                                                              // 26
   * Create the global controller. All contained methods and properties apply                                      // 27
   * to all sounds that are currently playing or will be in the future.                                            // 28
   */                                                                                                              // 29
  var HowlerGlobal = function() {                                                                                  // 30
    this.init();                                                                                                   // 31
  };                                                                                                               // 32
  HowlerGlobal.prototype = {                                                                                       // 33
    /**                                                                                                            // 34
     * Initialize the global Howler object.                                                                        // 35
     * @return {Howler}                                                                                            // 36
     */                                                                                                            // 37
    init: function() {                                                                                             // 38
      var self = this || Howler;                                                                                   // 39
                                                                                                                   // 40
      // Internal properties.                                                                                      // 41
      self._codecs = {};                                                                                           // 42
      self._howls = [];                                                                                            // 43
      self._muted = false;                                                                                         // 44
      self._volume = 1;                                                                                            // 45
                                                                                                                   // 46
      // Keeps track of the suspend/resume state of the AudioContext.                                              // 47
      self.state = 'running';                                                                                      // 48
      self.autoSuspend = true;                                                                                     // 49
                                                                                                                   // 50
      // Automatically begin the 30-second suspend process                                                         // 51
      self._autoSuspend();                                                                                         // 52
                                                                                                                   // 53
      // Set to false to disable the auto iOS enabler.                                                             // 54
      self.mobileAutoEnable = true;                                                                                // 55
                                                                                                                   // 56
      // No audio is available on this system if this is set to true.                                              // 57
      self.noAudio = noAudio;                                                                                      // 58
                                                                                                                   // 59
      // This will be true if the Web Audio API is available.                                                      // 60
      self.usingWebAudio = usingWebAudio;                                                                          // 61
                                                                                                                   // 62
      // Expose the AudioContext when using Web Audio.                                                             // 63
      self.ctx = ctx;                                                                                              // 64
                                                                                                                   // 65
      // Check for supported codecs.                                                                               // 66
      if (!noAudio) {                                                                                              // 67
        self._setupCodecs();                                                                                       // 68
      }                                                                                                            // 69
                                                                                                                   // 70
      return self;                                                                                                 // 71
    },                                                                                                             // 72
                                                                                                                   // 73
    /**                                                                                                            // 74
     * Get/set the global volume for all sounds.                                                                   // 75
     * @param  {Float} vol Volume from 0.0 to 1.0.                                                                 // 76
     * @return {Howler/Float}     Returns self or current volume.                                                  // 77
     */                                                                                                            // 78
    volume: function(vol) {                                                                                        // 79
      var self = this || Howler;                                                                                   // 80
      vol = parseFloat(vol);                                                                                       // 81
                                                                                                                   // 82
      if (typeof vol !== 'undefined' && vol >= 0 && vol <= 1) {                                                    // 83
        self._volume = vol;                                                                                        // 84
                                                                                                                   // 85
        // When using Web Audio, we just need to adjust the master gain.                                           // 86
        if (usingWebAudio) {                                                                                       // 87
          masterGain.gain.value = vol;                                                                             // 88
        }                                                                                                          // 89
                                                                                                                   // 90
        // Loop through and change volume for all HTML5 audio nodes.                                               // 91
        for (var i=0; i<self._howls.length; i++) {                                                                 // 92
          if (!self._howls[i]._webAudio) {                                                                         // 93
            // Get all of the sounds in this Howl group.                                                           // 94
            var ids = self._howls[i]._getSoundIds();                                                               // 95
                                                                                                                   // 96
            // Loop through all sounds and change the volumes.                                                     // 97
            for (var j=0; j<ids.length; j++) {                                                                     // 98
              var sound = self._howls[i]._soundById(ids[j]);                                                       // 99
                                                                                                                   // 100
              if (sound && sound._node) {                                                                          // 101
                sound._node.volume = sound._volume * vol;                                                          // 102
              }                                                                                                    // 103
            }                                                                                                      // 104
          }                                                                                                        // 105
        }                                                                                                          // 106
                                                                                                                   // 107
        return self;                                                                                               // 108
      }                                                                                                            // 109
                                                                                                                   // 110
      return self._volume;                                                                                         // 111
    },                                                                                                             // 112
                                                                                                                   // 113
    /**                                                                                                            // 114
     * Handle muting and unmuting globally.                                                                        // 115
     * @param  {Boolean} muted Is muted or not.                                                                    // 116
     */                                                                                                            // 117
    mute: function(muted) {                                                                                        // 118
      var self = this || Howler;                                                                                   // 119
                                                                                                                   // 120
      self._muted = muted;                                                                                         // 121
                                                                                                                   // 122
      // With Web Audio, we just need to mute the master gain.                                                     // 123
      if (usingWebAudio) {                                                                                         // 124
        masterGain.gain.value = muted ? 0 : self._volume;                                                          // 125
      }                                                                                                            // 126
                                                                                                                   // 127
      // Loop through and mute all HTML5 Audio nodes.                                                              // 128
      for (var i=0; i<self._howls.length; i++) {                                                                   // 129
        if (!self._howls[i]._webAudio) {                                                                           // 130
          // Get all of the sounds in this Howl group.                                                             // 131
          var ids = self._howls[i]._getSoundIds();                                                                 // 132
                                                                                                                   // 133
          // Loop through all sounds and mark the audio node as muted.                                             // 134
          for (var j=0; j<ids.length; j++) {                                                                       // 135
            var sound = self._howls[i]._soundById(ids[j]);                                                         // 136
                                                                                                                   // 137
            if (sound && sound._node) {                                                                            // 138
              sound._node.muted = (muted) ? true : sound._muted;                                                   // 139
            }                                                                                                      // 140
          }                                                                                                        // 141
        }                                                                                                          // 142
      }                                                                                                            // 143
                                                                                                                   // 144
      return self;                                                                                                 // 145
    },                                                                                                             // 146
                                                                                                                   // 147
    /**                                                                                                            // 148
     * Unload and destroy all currently loaded Howl objects.                                                       // 149
     * @return {Howler}                                                                                            // 150
     */                                                                                                            // 151
    unload: function() {                                                                                           // 152
      var self = this || Howler;                                                                                   // 153
                                                                                                                   // 154
      for (var i=self._howls.length-1; i>=0; i--) {                                                                // 155
        self._howls[i].unload();                                                                                   // 156
      }                                                                                                            // 157
                                                                                                                   // 158
      // Create a new AudioContext to make sure it is fully reset.                                                 // 159
      if (self.usingWebAudio && typeof ctx.close !== 'undefined') {                                                // 160
        self.ctx = null;                                                                                           // 161
        ctx.close();                                                                                               // 162
        setupAudioContext();                                                                                       // 163
        self.ctx = ctx;                                                                                            // 164
      }                                                                                                            // 165
                                                                                                                   // 166
      return self;                                                                                                 // 167
    },                                                                                                             // 168
                                                                                                                   // 169
    /**                                                                                                            // 170
     * Check for codec support of specific extension.                                                              // 171
     * @param  {String} ext Audio file extention.                                                                  // 172
     * @return {Boolean}                                                                                           // 173
     */                                                                                                            // 174
    codecs: function(ext) {                                                                                        // 175
      return (this || Howler)._codecs[ext];                                                                        // 176
    },                                                                                                             // 177
                                                                                                                   // 178
    /**                                                                                                            // 179
     * Check for browser support for various codecs and cache the results.                                         // 180
     * @return {Howler}                                                                                            // 181
     */                                                                                                            // 182
    _setupCodecs: function() {                                                                                     // 183
      var self = this || Howler;                                                                                   // 184
      var audioTest = new Audio();                                                                                 // 185
      var mpegTest = audioTest.canPlayType('audio/mpeg;').replace(/^no$/, '');                                     // 186
      var isOpera = /OPR\//.test(navigator.userAgent);                                                             // 187
                                                                                                                   // 188
      self._codecs = {                                                                                             // 189
        mp3: !!(!isOpera && (mpegTest || audioTest.canPlayType('audio/mp3;').replace(/^no$/, ''))),                // 190
        mpeg: !!mpegTest,                                                                                          // 191
        opus: !!audioTest.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/, ''),                             // 192
        ogg: !!audioTest.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),                            // 193
        wav: !!audioTest.canPlayType('audio/wav; codecs="1"').replace(/^no$/, ''),                                 // 194
        aac: !!audioTest.canPlayType('audio/aac;').replace(/^no$/, ''),                                            // 195
        m4a: !!(audioTest.canPlayType('audio/x-m4a;') || audioTest.canPlayType('audio/m4a;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
        mp4: !!(audioTest.canPlayType('audio/x-mp4;') || audioTest.canPlayType('audio/mp4;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
        weba: !!audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, ''),                          // 198
        webm: !!audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, '')                           // 199
      };                                                                                                           // 200
                                                                                                                   // 201
      return self;                                                                                                 // 202
    },                                                                                                             // 203
                                                                                                                   // 204
    /**                                                                                                            // 205
     * Mobile browsers will only allow audio to be played after a user interaction.                                // 206
     * Attempt to automatically unlock audio on the first user interaction.                                        // 207
     * Concept from: http://paulbakaus.com/tutorials/html5/web-audio-on-ios/                                       // 208
     * @return {Howler}                                                                                            // 209
     */                                                                                                            // 210
    _enableMobileAudio: function() {                                                                               // 211
      var self = this || Howler;                                                                                   // 212
                                                                                                                   // 213
      // Only run this on iOS if audio isn't already eanbled.                                                      // 214
      var isMobile = /iPhone|iPad|iPod|Android|BlackBerry|BB10|Silk/i.test(navigator.userAgent);                   // 215
      var isTouch = !!(('ontouchend' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
      if (ctx && (self._mobileEnabled || !isMobile || !isTouch)) {                                                 // 217
        return;                                                                                                    // 218
      }                                                                                                            // 219
                                                                                                                   // 220
      self._mobileEnabled = false;                                                                                 // 221
                                                                                                                   // 222
      // Call this method on touch start to create and play a buffer,                                              // 223
      // then check if the audio actually played to determine if                                                   // 224
      // audio has now been unlocked on iOS, Android, etc.                                                         // 225
      var unlock = function() {                                                                                    // 226
        // Create an empty buffer.                                                                                 // 227
        var buffer = ctx.createBuffer(1, 1, 22050);                                                                // 228
        var source = ctx.createBufferSource();                                                                     // 229
        source.buffer = buffer;                                                                                    // 230
        source.connect(ctx.destination);                                                                           // 231
                                                                                                                   // 232
        // Play the empty buffer.                                                                                  // 233
        if (typeof source.start === 'undefined') {                                                                 // 234
          source.noteOn(0);                                                                                        // 235
        } else {                                                                                                   // 236
          source.start(0);                                                                                         // 237
        }                                                                                                          // 238
                                                                                                                   // 239
        // Setup a timeout to check that we are unlocked on the next event loop.                                   // 240
        source.onended = function() {                                                                              // 241
          source.disconnect(0);                                                                                    // 242
                                                                                                                   // 243
          // Update the unlocked state and prevent this check from happening again.                                // 244
          self._mobileEnabled = true;                                                                              // 245
          self.mobileAutoEnable = false;                                                                           // 246
                                                                                                                   // 247
          // Remove the touch start listener.                                                                      // 248
          document.removeEventListener('touchend', unlock, true);                                                  // 249
        };                                                                                                         // 250
      };                                                                                                           // 251
                                                                                                                   // 252
      // Setup a touch start listener to attempt an unlock in.                                                     // 253
      document.addEventListener('touchend', unlock, true);                                                         // 254
                                                                                                                   // 255
      return self;                                                                                                 // 256
    },                                                                                                             // 257
                                                                                                                   // 258
    /**                                                                                                            // 259
     * Automatically suspend the Web Audio AudioContext after no sound has played for 30 seconds.                  // 260
     * This saves processing/energy and fixes various browser-specific bugs with audio getting stuck.              // 261
     * @return {Howler}                                                                                            // 262
     */                                                                                                            // 263
    _autoSuspend: function() {                                                                                     // 264
      var self = this;                                                                                             // 265
                                                                                                                   // 266
      if (!self.autoSuspend || !ctx || typeof ctx.suspend === 'undefined' || !usingWebAudio) {                     // 267
        return;                                                                                                    // 268
      }                                                                                                            // 269
                                                                                                                   // 270
      // Check if any sounds are playing.                                                                          // 271
      for (var i=0; i<self._howls.length; i++) {                                                                   // 272
        if (self._howls[i]._webAudio) {                                                                            // 273
          for (var j=0; j<self._howls[i]._sounds.length; j++) {                                                    // 274
            if (!self._howls[i]._sounds[j]._paused) {                                                              // 275
              return self;                                                                                         // 276
            }                                                                                                      // 277
          }                                                                                                        // 278
        }                                                                                                          // 279
      }                                                                                                            // 280
                                                                                                                   // 281
      // If no sound has played after 30 seconds, suspend the context.                                             // 282
      self._suspendTimer = setTimeout(function() {                                                                 // 283
        if (!self.autoSuspend) {                                                                                   // 284
          return;                                                                                                  // 285
        }                                                                                                          // 286
                                                                                                                   // 287
        self._suspendTimer = null;                                                                                 // 288
        self.state = 'suspending';                                                                                 // 289
        ctx.suspend().then(function() {                                                                            // 290
          self.state = 'suspended';                                                                                // 291
                                                                                                                   // 292
          if (self._resumeAfterSuspend) {                                                                          // 293
            delete self._resumeAfterSuspend;                                                                       // 294
            self._autoResume();                                                                                    // 295
          }                                                                                                        // 296
        });                                                                                                        // 297
      }, 30000);                                                                                                   // 298
                                                                                                                   // 299
      return self;                                                                                                 // 300
    },                                                                                                             // 301
                                                                                                                   // 302
    /**                                                                                                            // 303
     * Automatically resume the Web Audio AudioContext when a new sound is played.                                 // 304
     * @return {Howler}                                                                                            // 305
     */                                                                                                            // 306
    _autoResume: function() {                                                                                      // 307
      var self = this;                                                                                             // 308
                                                                                                                   // 309
      if (!ctx || typeof ctx.resume === 'undefined' || !usingWebAudio) {                                           // 310
        return;                                                                                                    // 311
      }                                                                                                            // 312
                                                                                                                   // 313
      if (self.state === 'running' && self._suspendTimer) {                                                        // 314
        clearTimeout(self._suspendTimer);                                                                          // 315
        self._suspendTimer = null;                                                                                 // 316
      } else if (self.state === 'suspended') {                                                                     // 317
        self.state = 'resuming';                                                                                   // 318
        ctx.resume().then(function() {                                                                             // 319
          self.state = 'running';                                                                                  // 320
        });                                                                                                        // 321
      } else if (self.state === 'suspending') {                                                                    // 322
        self._resumeAfterSuspend = true;                                                                           // 323
      }                                                                                                            // 324
                                                                                                                   // 325
      return self;                                                                                                 // 326
    }                                                                                                              // 327
  };                                                                                                               // 328
                                                                                                                   // 329
  // Setup the global audio controller.                                                                            // 330
  var Howler = new HowlerGlobal();                                                                                 // 331
                                                                                                                   // 332
  /** Group Methods **/                                                                                            // 333
  /***************************************************************************/                                    // 334
                                                                                                                   // 335
  /**                                                                                                              // 336
   * Create an audio group controller.                                                                             // 337
   * @param {Object} o Passed in properties for this group.                                                        // 338
   */                                                                                                              // 339
  var Howl = function(o) {                                                                                         // 340
    var self = this;                                                                                               // 341
                                                                                                                   // 342
    // Throw an error if no source is provided.                                                                    // 343
    if (!o.src || o.src.length === 0) {                                                                            // 344
      console.error('An array of source files must be passed with any new Howl.');                                 // 345
      return;                                                                                                      // 346
    }                                                                                                              // 347
                                                                                                                   // 348
    self.init(o);                                                                                                  // 349
  };                                                                                                               // 350
  Howl.prototype = {                                                                                               // 351
    /**                                                                                                            // 352
     * Initialize a new Howl group object.                                                                         // 353
     * @param  {Object} o Passed in properties for this group.                                                     // 354
     * @return {Howl}                                                                                              // 355
     */                                                                                                            // 356
    init: function(o) {                                                                                            // 357
      var self = this;                                                                                             // 358
                                                                                                                   // 359
      // Setup user-defined default properties.                                                                    // 360
      self._autoplay = o.autoplay || false;                                                                        // 361
      self._ext = o.ext || null;                                                                                   // 362
      self._html5 = o.html5 || false;                                                                              // 363
      self._muted = o.mute || false;                                                                               // 364
      self._loop = o.loop || false;                                                                                // 365
      self._pool = o.pool || 5;                                                                                    // 366
      self._preload = (typeof o.preload === 'boolean') ? o.preload : true;                                         // 367
      self._rate = o.rate || 1;                                                                                    // 368
      self._sprite = o.sprite || {};                                                                               // 369
      self._src = (typeof o.src !== 'string') ? o.src : [o.src];                                                   // 370
      self._volume = o.volume !== undefined ? o.volume : 1;                                                        // 371
                                                                                                                   // 372
      // Setup all other default properties.                                                                       // 373
      self._duration = 0;                                                                                          // 374
      self._loaded = false;                                                                                        // 375
      self._sounds = [];                                                                                           // 376
      self._endTimers = {};                                                                                        // 377
                                                                                                                   // 378
      // Setup event listeners.                                                                                    // 379
      self._onend = o.onend ? [{fn: o.onend}] : [];                                                                // 380
      self._onfaded = o.onfaded ? [{fn: o.onfaded}] : [];                                                          // 381
      self._onload = o.onload ? [{fn: o.onload}] : [];                                                             // 382
      self._onloaderror = o.onloaderror ? [{fn: o.onloaderror}] : [];                                              // 383
      self._onpause = o.onpause ? [{fn: o.onpause}] : [];                                                          // 384
      self._onplay = o.onplay ? [{fn: o.onplay}] : [];                                                             // 385
      self._onstop = o.onstop ? [{fn: o.onstop}] : [];                                                             // 386
                                                                                                                   // 387
      // Web Audio or HTML5 Audio?                                                                                 // 388
      self._webAudio = usingWebAudio && !self._html5;                                                              // 389
                                                                                                                   // 390
      // Automatically try to enable audio on iOS.                                                                 // 391
      if (typeof ctx !== 'undefined' && ctx && Howler.mobileAutoEnable) {                                          // 392
        Howler._enableMobileAudio();                                                                               // 393
      }                                                                                                            // 394
                                                                                                                   // 395
      // Keep track of this Howl group in the global controller.                                                   // 396
      Howler._howls.push(self);                                                                                    // 397
                                                                                                                   // 398
      // Load the source file unless otherwise specified.                                                          // 399
      if (self._preload) {                                                                                         // 400
        self.load();                                                                                               // 401
      }                                                                                                            // 402
                                                                                                                   // 403
      return self;                                                                                                 // 404
    },                                                                                                             // 405
                                                                                                                   // 406
    /**                                                                                                            // 407
     * Load the audio file.                                                                                        // 408
     * @return {Howler}                                                                                            // 409
     */                                                                                                            // 410
    load: function() {                                                                                             // 411
      var self = this;                                                                                             // 412
      var url = null;                                                                                              // 413
                                                                                                                   // 414
      // If no audio is available, quit immediately.                                                               // 415
      if (noAudio) {                                                                                               // 416
        self._emit('loaderror', null, 'No audio support.');                                                        // 417
        return;                                                                                                    // 418
      }                                                                                                            // 419
                                                                                                                   // 420
      // Make sure our source is in an array.                                                                      // 421
      if (typeof self._src === 'string') {                                                                         // 422
        self._src = [self._src];                                                                                   // 423
      }                                                                                                            // 424
                                                                                                                   // 425
      // Loop through the sources and pick the first one that is compatible.                                       // 426
      for (var i=0; i<self._src.length; i++) {                                                                     // 427
        var ext, str;                                                                                              // 428
                                                                                                                   // 429
        if (self._ext && self._ext[i]) {                                                                           // 430
          // If an extension was specified, use that instead.                                                      // 431
          ext = self._ext[i];                                                                                      // 432
        } else {                                                                                                   // 433
          // Extract the file extension from the URL or base64 data URI.                                           // 434
          str = self._src[i];                                                                                      // 435
          ext = /^data:audio\/([^;,]+);/i.exec(str);                                                               // 436
          if (!ext) {                                                                                              // 437
            ext = /\.([^.]+)$/.exec(str.split('?', 1)[0]);                                                         // 438
          }                                                                                                        // 439
                                                                                                                   // 440
          if (ext) {                                                                                               // 441
            ext = ext[1].toLowerCase();                                                                            // 442
          }                                                                                                        // 443
        }                                                                                                          // 444
                                                                                                                   // 445
        // Check if this extension is available.                                                                   // 446
        if (Howler.codecs(ext)) {                                                                                  // 447
          url = self._src[i];                                                                                      // 448
          break;                                                                                                   // 449
        }                                                                                                          // 450
      }                                                                                                            // 451
                                                                                                                   // 452
      if (!url) {                                                                                                  // 453
        self._emit('loaderror', null, 'No codec support for selected audio sources.');                             // 454
        return;                                                                                                    // 455
      }                                                                                                            // 456
                                                                                                                   // 457
      self._src = url;                                                                                             // 458
                                                                                                                   // 459
      // If the hosting page is HTTPS and the source isn't,                                                        // 460
      // drop down to HTML5 Audio to avoid Mixed Content errors.                                                   // 461
      if (window.location.protocol === 'https:' && url.slice(0, 5) === 'http:') {                                  // 462
        self._html5 = true;                                                                                        // 463
        self._webAudio = false;                                                                                    // 464
      }                                                                                                            // 465
                                                                                                                   // 466
      // Create a new sound object and add it to the pool.                                                         // 467
      new Sound(self);                                                                                             // 468
                                                                                                                   // 469
      // Load and decode the audio data for playback.                                                              // 470
      if (self._webAudio) {                                                                                        // 471
        loadBuffer(self);                                                                                          // 472
      }                                                                                                            // 473
                                                                                                                   // 474
      return self;                                                                                                 // 475
    },                                                                                                             // 476
                                                                                                                   // 477
    /**                                                                                                            // 478
     * Play a sound or resume previous playback.                                                                   // 479
     * @param  {String/Number} sprite Sprite name for sprite playback or sound id to continue previous.            // 480
     * @return {Number}        Sound ID.                                                                           // 481
     */                                                                                                            // 482
    play: function(sprite) {                                                                                       // 483
      var self = this;                                                                                             // 484
      var args = arguments;                                                                                        // 485
      var id = null;                                                                                               // 486
                                                                                                                   // 487
      // Determine if a sprite, sound id or nothing was passed                                                     // 488
      if (typeof sprite === 'number') {                                                                            // 489
        id = sprite;                                                                                               // 490
        sprite = null;                                                                                             // 491
      } else if (typeof sprite === 'undefined') {                                                                  // 492
        // Use the default sound sprite (plays the full audio length).                                             // 493
        sprite = '__default';                                                                                      // 494
                                                                                                                   // 495
        // Check if there is a single paused sound that isn't ended.                                               // 496
        // If there is, play that sound. If not, continue as usual.                                                // 497
        var num = 0;                                                                                               // 498
        for (var i=0; i<self._sounds.length; i++) {                                                                // 499
          if (self._sounds[i]._paused && !self._sounds[i]._ended) {                                                // 500
            num++;                                                                                                 // 501
            id = self._sounds[i]._id;                                                                              // 502
          }                                                                                                        // 503
        }                                                                                                          // 504
                                                                                                                   // 505
        if (num === 1) {                                                                                           // 506
          sprite = null;                                                                                           // 507
        } else {                                                                                                   // 508
          id = null;                                                                                               // 509
        }                                                                                                          // 510
      }                                                                                                            // 511
                                                                                                                   // 512
      // Get the selected node, or get one from the pool.                                                          // 513
      var sound = id ? self._soundById(id) : self._inactiveSound();                                                // 514
                                                                                                                   // 515
      // If the sound doesn't exist, do nothing.                                                                   // 516
      if (!sound) {                                                                                                // 517
        return null;                                                                                               // 518
      }                                                                                                            // 519
                                                                                                                   // 520
      // Select the sprite definition.                                                                             // 521
      if (id && !sprite) {                                                                                         // 522
        sprite = sound._sprite || '__default';                                                                     // 523
      }                                                                                                            // 524
                                                                                                                   // 525
      // If we have no sprite and the sound hasn't loaded, we must wait                                            // 526
      // for the sound to load to get our audio's duration.                                                        // 527
      if (!self._loaded && !self._sprite[sprite]) {                                                                // 528
        self.once('load', function() {                                                                             // 529
          self.play(self._soundById(sound._id) ? sound._id : undefined);                                           // 530
        });                                                                                                        // 531
        return sound._id;                                                                                          // 532
      }                                                                                                            // 533
                                                                                                                   // 534
      // Don't play the sound if an id was passed and it is already playing.                                       // 535
      if (id && !sound._paused) {                                                                                  // 536
        return sound._id;                                                                                          // 537
      }                                                                                                            // 538
                                                                                                                   // 539
      // Make sure the AudioContext isn't suspended, and resume it if it is.                                       // 540
      if (self._webAudio) {                                                                                        // 541
        Howler._autoResume();                                                                                      // 542
      }                                                                                                            // 543
                                                                                                                   // 544
      // Determine how long to play for and where to start playing.                                                // 545
      var seek = sound._seek > 0 ? sound._seek : self._sprite[sprite][0] / 1000;                                   // 546
      var duration = ((self._sprite[sprite][0] + self._sprite[sprite][1]) / 1000) - seek;                          // 547
                                                                                                                   // 548
      // Create a timer to fire at the end of playback or the start of a new loop.                                 // 549
      var timeout = (duration * 1000) / Math.abs(sound._rate);                                                     // 550
      if (timeout !== Infinity) {                                                                                  // 551
        self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);                           // 552
      }                                                                                                            // 553
                                                                                                                   // 554
      // Update the parameters of the sound                                                                        // 555
      sound._paused = false;                                                                                       // 556
      sound._ended = false;                                                                                        // 557
      sound._sprite = sprite;                                                                                      // 558
      sound._seek = seek;                                                                                          // 559
      sound._start = self._sprite[sprite][0] / 1000;                                                               // 560
      sound._stop = (self._sprite[sprite][0] + self._sprite[sprite][1]) / 1000;                                    // 561
      sound._loop = !!(sound._loop || self._sprite[sprite][2]);                                                    // 562
                                                                                                                   // 563
      // Begin the actual playback.                                                                                // 564
      var node = sound._node;                                                                                      // 565
      if (self._webAudio) {                                                                                        // 566
        // Fire this when the sound is ready to play to begin Web Audio playback.                                  // 567
        var playWebAudio = function() {                                                                            // 568
          self._refreshBuffer(sound);                                                                              // 569
                                                                                                                   // 570
          // Setup the playback params.                                                                            // 571
          var vol = (sound._muted || self._muted) ? 0 : sound._volume * Howler.volume();                           // 572
          node.gain.setValueAtTime(vol, ctx.currentTime);                                                          // 573
          sound._playStart = ctx.currentTime;                                                                      // 574
                                                                                                                   // 575
          // Play the sound using the supported method.                                                            // 576
          if (typeof node.bufferSource.start === 'undefined') {                                                    // 577
            sound._loop ? node.bufferSource.noteGrainOn(0, seek, 86400) : node.bufferSource.noteGrainOn(0, seek, duration);
          } else {                                                                                                 // 579
            sound._loop ? node.bufferSource.start(0, seek, 86400) : node.bufferSource.start(0, seek, duration);    // 580
          }                                                                                                        // 581
                                                                                                                   // 582
          // Start a new timer if none is present.                                                                 // 583
          if (!self._endTimers[sound._id] && timeout !== Infinity) {                                               // 584
            self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);                       // 585
          }                                                                                                        // 586
                                                                                                                   // 587
          if (!args[1]) {                                                                                          // 588
            setTimeout(function() {                                                                                // 589
              self._emit('play', sound._id);                                                                       // 590
            }, 0);                                                                                                 // 591
          }                                                                                                        // 592
        };                                                                                                         // 593
                                                                                                                   // 594
        if (self._loaded) {                                                                                        // 595
          playWebAudio();                                                                                          // 596
        } else {                                                                                                   // 597
          // Wait for the audio to load and then begin playback.                                                   // 598
          self.once('load', playWebAudio);                                                                         // 599
                                                                                                                   // 600
          // Cancel the end timer.                                                                                 // 601
          self._clearTimer(sound._id);                                                                             // 602
        }                                                                                                          // 603
      } else {                                                                                                     // 604
        // Fire this when the sound is ready to play to begin HTML5 Audio playback.                                // 605
        var playHtml5 = function() {                                                                               // 606
          node.currentTime = seek;                                                                                 // 607
          node.muted = sound._muted || self._muted || Howler._muted || node.muted;                                 // 608
          node.volume = sound._volume * Howler.volume();                                                           // 609
          node.playbackRate = sound._rate;                                                                         // 610
          setTimeout(function() {                                                                                  // 611
            node.play();                                                                                           // 612
            if (!args[1]) {                                                                                        // 613
              self._emit('play', sound._id);                                                                       // 614
            }                                                                                                      // 615
          }, 0);                                                                                                   // 616
        };                                                                                                         // 617
                                                                                                                   // 618
        // Play immediately if ready, or wait for the 'canplaythrough'e vent.                                      // 619
        if (node.readyState === 4 || !node.readyState && navigator.isCocoonJS) {                                   // 620
          playHtml5();                                                                                             // 621
        } else {                                                                                                   // 622
          var listener = function() {                                                                              // 623
            // Setup the new end timer.                                                                            // 624
            if (timeout !== Infinity) {                                                                            // 625
              self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);                     // 626
            }                                                                                                      // 627
                                                                                                                   // 628
            // Begin playback.                                                                                     // 629
            playHtml5();                                                                                           // 630
                                                                                                                   // 631
            // Clear this listener.                                                                                // 632
            node.removeEventListener(canPlayEvent, listener, false);                                               // 633
          };                                                                                                       // 634
          node.addEventListener(canPlayEvent, listener, false);                                                    // 635
                                                                                                                   // 636
          // Cancel the end timer.                                                                                 // 637
          self._clearTimer(sound._id);                                                                             // 638
        }                                                                                                          // 639
      }                                                                                                            // 640
                                                                                                                   // 641
      return sound._id;                                                                                            // 642
    },                                                                                                             // 643
                                                                                                                   // 644
    /**                                                                                                            // 645
     * Pause playback and save current position.                                                                   // 646
     * @param  {Number} id The sound ID (empty to pause all in group).                                             // 647
     * @return {Howl}                                                                                              // 648
     */                                                                                                            // 649
    pause: function(id) {                                                                                          // 650
      var self = this;                                                                                             // 651
                                                                                                                   // 652
      // Wait for the sound to begin playing before pausing it.                                                    // 653
      if (!self._loaded) {                                                                                         // 654
        self.once('play', function() {                                                                             // 655
          self.pause(id);                                                                                          // 656
        });                                                                                                        // 657
                                                                                                                   // 658
        return self;                                                                                               // 659
      }                                                                                                            // 660
                                                                                                                   // 661
      // If no id is passed, get all ID's to be paused.                                                            // 662
      var ids = self._getSoundIds(id);                                                                             // 663
                                                                                                                   // 664
      for (var i=0; i<ids.length; i++) {                                                                           // 665
        // Clear the end timer.                                                                                    // 666
        self._clearTimer(ids[i]);                                                                                  // 667
                                                                                                                   // 668
        // Get the sound.                                                                                          // 669
        var sound = self._soundById(ids[i]);                                                                       // 670
                                                                                                                   // 671
        if (sound && !sound._paused) {                                                                             // 672
          // Reset the seek position.                                                                              // 673
          sound._seek = self.seek(ids[i]);                                                                         // 674
          sound._paused = true;                                                                                    // 675
                                                                                                                   // 676
          // Stop currently running fades.                                                                         // 677
          self._stopFade(ids[i]);                                                                                  // 678
                                                                                                                   // 679
          if (sound._node) {                                                                                       // 680
            if (self._webAudio) {                                                                                  // 681
              // make sure the sound has been created                                                              // 682
              if (!sound._node.bufferSource) {                                                                     // 683
                return self;                                                                                       // 684
              }                                                                                                    // 685
                                                                                                                   // 686
              if (typeof sound._node.bufferSource.stop === 'undefined') {                                          // 687
                sound._node.bufferSource.noteOff(0);                                                               // 688
              } else {                                                                                             // 689
                sound._node.bufferSource.stop(0);                                                                  // 690
              }                                                                                                    // 691
                                                                                                                   // 692
              // Clean up the buffer source.                                                                       // 693
              sound._node.bufferSource = null;                                                                     // 694
            } else if (!isNaN(sound._node.duration) || sound._node.duration === Infinity) {                        // 695
              sound._node.pause();                                                                                 // 696
            }                                                                                                      // 697
          }                                                                                                        // 698
                                                                                                                   // 699
          // Fire the pause event, unless `true` is passed as the 2nd argument.                                    // 700
          if (!arguments[1]) {                                                                                     // 701
            self._emit('pause', sound._id);                                                                        // 702
          }                                                                                                        // 703
        }                                                                                                          // 704
      }                                                                                                            // 705
                                                                                                                   // 706
      return self;                                                                                                 // 707
    },                                                                                                             // 708
                                                                                                                   // 709
    /**                                                                                                            // 710
     * Stop playback and reset to start.                                                                           // 711
     * @param  {Number} id The sound ID (empty to stop all in group).                                              // 712
     * @return {Howl}                                                                                              // 713
     */                                                                                                            // 714
    stop: function(id) {                                                                                           // 715
      var self = this;                                                                                             // 716
                                                                                                                   // 717
      // Wait for the sound to begin playing before stopping it.                                                   // 718
      if (!self._loaded) {                                                                                         // 719
        if (typeof self._sounds[0]._sprite !== 'undefined') {                                                      // 720
          self.once('play', function() {                                                                           // 721
            self.stop(id);                                                                                         // 722
          });                                                                                                      // 723
        }                                                                                                          // 724
                                                                                                                   // 725
        return self;                                                                                               // 726
      }                                                                                                            // 727
                                                                                                                   // 728
      // If no id is passed, get all ID's to be stopped.                                                           // 729
      var ids = self._getSoundIds(id);                                                                             // 730
                                                                                                                   // 731
      for (var i=0; i<ids.length; i++) {                                                                           // 732
        // Clear the end timer.                                                                                    // 733
        self._clearTimer(ids[i]);                                                                                  // 734
                                                                                                                   // 735
        // Get the sound.                                                                                          // 736
        var sound = self._soundById(ids[i]);                                                                       // 737
                                                                                                                   // 738
        if (sound && !sound._paused) {                                                                             // 739
          // Reset the seek position.                                                                              // 740
          sound._seek = sound._start || 0;                                                                         // 741
          sound._paused = true;                                                                                    // 742
          sound._ended = true;                                                                                     // 743
                                                                                                                   // 744
          // Stop currently running fades.                                                                         // 745
          self._stopFade(ids[i]);                                                                                  // 746
                                                                                                                   // 747
          if (sound._node) {                                                                                       // 748
            if (self._webAudio) {                                                                                  // 749
              // make sure the sound has been created                                                              // 750
              if (!sound._node.bufferSource) {                                                                     // 751
                return self;                                                                                       // 752
              }                                                                                                    // 753
                                                                                                                   // 754
              if (typeof sound._node.bufferSource.stop === 'undefined') {                                          // 755
                sound._node.bufferSource.noteOff(0);                                                               // 756
              } else {                                                                                             // 757
                sound._node.bufferSource.stop(0);                                                                  // 758
              }                                                                                                    // 759
                                                                                                                   // 760
              // Clean up the buffer source.                                                                       // 761
              sound._node.bufferSource = null;                                                                     // 762
            } else if (!isNaN(sound._node.duration) || sound._node.duration === Infinity) {                        // 763
              sound._node.pause();                                                                                 // 764
              sound._node.currentTime = sound._start || 0;                                                         // 765
            }                                                                                                      // 766
          }                                                                                                        // 767
                                                                                                                   // 768
          self._emit('stop', sound._id);                                                                           // 769
        }                                                                                                          // 770
      }                                                                                                            // 771
                                                                                                                   // 772
      return self;                                                                                                 // 773
    },                                                                                                             // 774
                                                                                                                   // 775
    /**                                                                                                            // 776
     * Mute/unmute a single sound or all sounds in this Howl group.                                                // 777
     * @param  {Boolean} muted Set to true to mute and false to unmute.                                            // 778
     * @param  {Number} id    The sound ID to update (omit to mute/unmute all).                                    // 779
     * @return {Howl}                                                                                              // 780
     */                                                                                                            // 781
    mute: function(muted, id) {                                                                                    // 782
      var self = this;                                                                                             // 783
                                                                                                                   // 784
      // Wait for the sound to begin playing before muting it.                                                     // 785
      if (!self._loaded) {                                                                                         // 786
        self.once('play', function() {                                                                             // 787
          self.mute(muted, id);                                                                                    // 788
        });                                                                                                        // 789
                                                                                                                   // 790
        return self;                                                                                               // 791
      }                                                                                                            // 792
                                                                                                                   // 793
      // If applying mute/unmute to all sounds, update the group's value.                                          // 794
      if (typeof id === 'undefined') {                                                                             // 795
        if (typeof muted === 'boolean') {                                                                          // 796
          self._muted = muted;                                                                                     // 797
        } else {                                                                                                   // 798
          return self._muted;                                                                                      // 799
        }                                                                                                          // 800
      }                                                                                                            // 801
                                                                                                                   // 802
      // If no id is passed, get all ID's to be muted.                                                             // 803
      var ids = self._getSoundIds(id);                                                                             // 804
                                                                                                                   // 805
      for (var i=0; i<ids.length; i++) {                                                                           // 806
        // Get the sound.                                                                                          // 807
        var sound = self._soundById(ids[i]);                                                                       // 808
                                                                                                                   // 809
        if (sound) {                                                                                               // 810
          sound._muted = muted;                                                                                    // 811
                                                                                                                   // 812
          if (self._webAudio && sound._node) {                                                                     // 813
            sound._node.gain.setValueAtTime(muted ? 0 : sound._volume * Howler.volume(), ctx.currentTime);         // 814
          } else if (sound._node) {                                                                                // 815
            sound._node.muted = Howler._muted ? true : muted;                                                      // 816
          }                                                                                                        // 817
        }                                                                                                          // 818
      }                                                                                                            // 819
                                                                                                                   // 820
      return self;                                                                                                 // 821
    },                                                                                                             // 822
                                                                                                                   // 823
    /**                                                                                                            // 824
     * Get/set the volume of this sound or of the Howl group. This method can optionally take 0, 1 or 2 arguments. // 825
     *   volume() -> Returns the group's volume value.                                                             // 826
     *   volume(id) -> Returns the sound id's current volume.                                                      // 827
     *   volume(vol) -> Sets the volume of all sounds in this Howl group.                                          // 828
     *   volume(vol, id) -> Sets the volume of passed sound id.                                                    // 829
     * @return {Howl/Number} Returns self or current volume.                                                       // 830
     */                                                                                                            // 831
    volume: function() {                                                                                           // 832
      var self = this;                                                                                             // 833
      var args = arguments;                                                                                        // 834
      var vol, id;                                                                                                 // 835
                                                                                                                   // 836
      // Determine the values based on arguments.                                                                  // 837
      if (args.length === 0) {                                                                                     // 838
        // Return the value of the groups' volume.                                                                 // 839
        return self._volume;                                                                                       // 840
      } else if (args.length === 1) {                                                                              // 841
        // First check if this is an ID, and if not, assume it is a new volume.                                    // 842
        var ids = self._getSoundIds();                                                                             // 843
        var index = ids.indexOf(args[0]);                                                                          // 844
        if (index >= 0) {                                                                                          // 845
          id = parseInt(args[0], 10);                                                                              // 846
        } else {                                                                                                   // 847
          vol = parseFloat(args[0]);                                                                               // 848
        }                                                                                                          // 849
      } else if (args.length >= 2) {                                                                               // 850
        vol = parseFloat(args[0]);                                                                                 // 851
        id = parseInt(args[1], 10);                                                                                // 852
      }                                                                                                            // 853
                                                                                                                   // 854
      // Update the volume or return the current volume.                                                           // 855
      var sound;                                                                                                   // 856
      if (typeof vol !== 'undefined' && vol >= 0 && vol <= 1) {                                                    // 857
        // Wait for the sound to begin playing before changing the volume.                                         // 858
        if (!self._loaded) {                                                                                       // 859
          self.once('play', function() {                                                                           // 860
            self.volume.apply(self, args);                                                                         // 861
          });                                                                                                      // 862
                                                                                                                   // 863
          return self;                                                                                             // 864
        }                                                                                                          // 865
                                                                                                                   // 866
        // Set the group volume.                                                                                   // 867
        if (typeof id === 'undefined') {                                                                           // 868
          self._volume = vol;                                                                                      // 869
        }                                                                                                          // 870
                                                                                                                   // 871
        // Update one or all volumes.                                                                              // 872
        id = self._getSoundIds(id);                                                                                // 873
        for (var i=0; i<id.length; i++) {                                                                          // 874
          // Get the sound.                                                                                        // 875
          sound = self._soundById(id[i]);                                                                          // 876
                                                                                                                   // 877
          if (sound) {                                                                                             // 878
            sound._volume = vol;                                                                                   // 879
                                                                                                                   // 880
            // Stop currently running fades.                                                                       // 881
            if (!args[2]) {                                                                                        // 882
              self._stopFade(id[i]);                                                                               // 883
            }                                                                                                      // 884
                                                                                                                   // 885
            if (self._webAudio && sound._node && !sound._muted) {                                                  // 886
              sound._node.gain.setValueAtTime(vol * Howler.volume(), ctx.currentTime);                             // 887
            } else if (sound._node && !sound._muted) {                                                             // 888
              sound._node.volume = vol * Howler.volume();                                                          // 889
            }                                                                                                      // 890
          }                                                                                                        // 891
        }                                                                                                          // 892
      } else {                                                                                                     // 893
        sound = id ? self._soundById(id) : self._sounds[0];                                                        // 894
        return sound ? sound._volume : 0;                                                                          // 895
      }                                                                                                            // 896
                                                                                                                   // 897
      return self;                                                                                                 // 898
    },                                                                                                             // 899
                                                                                                                   // 900
    /**                                                                                                            // 901
     * Fade a currently playing sound between two volumes (if no id is passsed, all sounds will fade).             // 902
     * @param  {Number} from The value to fade from (0.0 to 1.0).                                                  // 903
     * @param  {Number} to   The volume to fade to (0.0 to 1.0).                                                   // 904
     * @param  {Number} len  Time in milliseconds to fade.                                                         // 905
     * @param  {Number} id   The sound id (omit to fade all sounds).                                               // 906
     * @return {Howl}                                                                                              // 907
     */                                                                                                            // 908
    fade: function(from, to, len, id) {                                                                            // 909
      var self = this;                                                                                             // 910
                                                                                                                   // 911
      // Wait for the sound to play before fading.                                                                 // 912
      if (!self._loaded) {                                                                                         // 913
        self.once('play', function() {                                                                             // 914
          self.fade(from, to, len, id);                                                                            // 915
        });                                                                                                        // 916
                                                                                                                   // 917
        return self;                                                                                               // 918
      }                                                                                                            // 919
                                                                                                                   // 920
      // Set the volume to the start position.                                                                     // 921
      self.volume(from, id);                                                                                       // 922
                                                                                                                   // 923
      // Fade the volume of one or all sounds.                                                                     // 924
      var ids = self._getSoundIds(id);                                                                             // 925
      for (var i=0; i<ids.length; i++) {                                                                           // 926
        // Get the sound.                                                                                          // 927
        var sound = self._soundById(ids[i]);                                                                       // 928
                                                                                                                   // 929
        // Create a linear fade or fall back to timeouts with HTML5 Audio.                                         // 930
        if (sound) {                                                                                               // 931
          if (self._webAudio && !sound._muted) {                                                                   // 932
            var currentTime = ctx.currentTime;                                                                     // 933
            var end = currentTime + (len / 1000);                                                                  // 934
            sound._volume = from;                                                                                  // 935
            sound._node.gain.setValueAtTime(from, currentTime);                                                    // 936
            sound._node.gain.linearRampToValueAtTime(to, end);                                                     // 937
                                                                                                                   // 938
            // Fire the event when complete.                                                                       // 939
            sound._timeout = setTimeout(function(id, sound) {                                                      // 940
              delete sound._timeout;                                                                               // 941
              setTimeout(function() {                                                                              // 942
                sound._volume = to;                                                                                // 943
                self._emit('faded', id);                                                                           // 944
              }, end - ctx.currentTime > 0 ? Math.ceil((end - ctx.currentTime) * 1000) : 0);                       // 945
            }.bind(self, ids[i], sound), len);                                                                     // 946
          } else {                                                                                                 // 947
            var diff = Math.abs(from - to);                                                                        // 948
            var dir = from > to ? 'out' : 'in';                                                                    // 949
            var steps = diff / 0.01;                                                                               // 950
            var stepLen = len / steps;                                                                             // 951
                                                                                                                   // 952
            (function() {                                                                                          // 953
              var vol = from;                                                                                      // 954
              sound._interval = setInterval(function(id, sound) {                                                  // 955
                // Update the volume amount.                                                                       // 956
                vol += (dir === 'in' ? 0.01 : -0.01);                                                              // 957
                                                                                                                   // 958
                // Make sure the volume is in the right bounds.                                                    // 959
                vol = Math.max(0, vol);                                                                            // 960
                vol = Math.min(1, vol);                                                                            // 961
                                                                                                                   // 962
                // Round to within 2 decimal points.                                                               // 963
                vol = Math.round(vol * 100) / 100;                                                                 // 964
                                                                                                                   // 965
                // Change the volume.                                                                              // 966
                self.volume(vol, id, true);                                                                        // 967
                                                                                                                   // 968
                // When the fade is complete, stop it and fire event.                                              // 969
                if (vol === to) {                                                                                  // 970
                  clearInterval(sound._interval);                                                                  // 971
                  delete sound._interval;                                                                          // 972
                  self._emit('faded', id);                                                                         // 973
                }                                                                                                  // 974
              }.bind(self, ids[i], sound), stepLen);                                                               // 975
            })();                                                                                                  // 976
          }                                                                                                        // 977
        }                                                                                                          // 978
      }                                                                                                            // 979
                                                                                                                   // 980
      return self;                                                                                                 // 981
    },                                                                                                             // 982
                                                                                                                   // 983
    /**                                                                                                            // 984
     * Internal method that stops the currently playing fade when                                                  // 985
     * a new fade starts, volume is changed or the sound is stopped.                                               // 986
     * @param  {Number} id The sound id.                                                                           // 987
     * @return {Howl}                                                                                              // 988
     */                                                                                                            // 989
    _stopFade: function(id) {                                                                                      // 990
      var self = this;                                                                                             // 991
      var sound = self._soundById(id);                                                                             // 992
                                                                                                                   // 993
      if (sound._interval) {                                                                                       // 994
        clearInterval(sound._interval);                                                                            // 995
        delete sound._interval;                                                                                    // 996
        self._emit('faded', id);                                                                                   // 997
      } else if (sound._timeout) {                                                                                 // 998
        clearTimeout(sound._timeout);                                                                              // 999
        delete sound._timeout;                                                                                     // 1000
        sound._node.gain.cancelScheduledValues(ctx.currentTime);                                                   // 1001
        self._emit('faded', id);                                                                                   // 1002
      }                                                                                                            // 1003
                                                                                                                   // 1004
      return self;                                                                                                 // 1005
    },                                                                                                             // 1006
                                                                                                                   // 1007
    /**                                                                                                            // 1008
     * Get/set the loop parameter on a sound. This method can optionally take 0, 1 or 2 arguments.                 // 1009
     *   loop() -> Returns the group's loop value.                                                                 // 1010
     *   loop(id) -> Returns the sound id's loop value.                                                            // 1011
     *   loop(loop) -> Sets the loop value for all sounds in this Howl group.                                      // 1012
     *   loop(loop, id) -> Sets the loop value of passed sound id.                                                 // 1013
     * @return {Howl/Boolean} Returns self or current loop value.                                                  // 1014
     */                                                                                                            // 1015
    loop: function() {                                                                                             // 1016
      var self = this;                                                                                             // 1017
      var args = arguments;                                                                                        // 1018
      var loop, id, sound;                                                                                         // 1019
                                                                                                                   // 1020
      // Determine the values for loop and id.                                                                     // 1021
      if (args.length === 0) {                                                                                     // 1022
        // Return the grou's loop value.                                                                           // 1023
        return self._loop;                                                                                         // 1024
      } else if (args.length === 1) {                                                                              // 1025
        if (typeof args[0] === 'boolean') {                                                                        // 1026
          loop = args[0];                                                                                          // 1027
          self._loop = loop;                                                                                       // 1028
        } else {                                                                                                   // 1029
          // Return this sound's loop value.                                                                       // 1030
          sound = self._soundById(parseInt(args[0], 10));                                                          // 1031
          return sound ? sound._loop : false;                                                                      // 1032
        }                                                                                                          // 1033
      } else if (args.length === 2) {                                                                              // 1034
        loop = args[0];                                                                                            // 1035
        id = parseInt(args[1], 10);                                                                                // 1036
      }                                                                                                            // 1037
                                                                                                                   // 1038
      // If no id is passed, get all ID's to be looped.                                                            // 1039
      var ids = self._getSoundIds(id);                                                                             // 1040
      for (var i=0; i<ids.length; i++) {                                                                           // 1041
        sound = self._soundById(ids[i]);                                                                           // 1042
                                                                                                                   // 1043
        if (sound) {                                                                                               // 1044
          sound._loop = loop;                                                                                      // 1045
          if (self._webAudio && sound._node && sound._node.bufferSource) {                                         // 1046
            sound._node.bufferSource.loop = loop;                                                                  // 1047
          }                                                                                                        // 1048
        }                                                                                                          // 1049
      }                                                                                                            // 1050
                                                                                                                   // 1051
      return self;                                                                                                 // 1052
    },                                                                                                             // 1053
                                                                                                                   // 1054
    /**                                                                                                            // 1055
     * Get/set the playback rate of a sound. This method can optionally take 0, 1 or 2 arguments.                  // 1056
     *   rate() -> Returns the first sound node's current playback rate.                                           // 1057
     *   rate(id) -> Returns the sound id's current playback rate.                                                 // 1058
     *   rate(rate) -> Sets the playback rate of all sounds in this Howl group.                                    // 1059
     *   rate(rate, id) -> Sets the playback rate of passed sound id.                                              // 1060
     * @return {Howl/Number} Returns self or the current playback rate.                                            // 1061
     */                                                                                                            // 1062
    rate: function() {                                                                                             // 1063
      var self = this;                                                                                             // 1064
      var args = arguments;                                                                                        // 1065
      var rate, id;                                                                                                // 1066
                                                                                                                   // 1067
      // Determine the values based on arguments.                                                                  // 1068
      if (args.length === 0) {                                                                                     // 1069
        // We will simply return the current rate of the first node.                                               // 1070
        id = self._sounds[0]._id;                                                                                  // 1071
      } else if (args.length === 1) {                                                                              // 1072
        // First check if this is an ID, and if not, assume it is a new rate value.                                // 1073
        var ids = self._getSoundIds();                                                                             // 1074
        var index = ids.indexOf(args[0]);                                                                          // 1075
        if (index >= 0) {                                                                                          // 1076
          id = parseInt(args[0], 10);                                                                              // 1077
        } else {                                                                                                   // 1078
          rate = parseFloat(args[0]);                                                                              // 1079
        }                                                                                                          // 1080
      } else if (args.length === 2) {                                                                              // 1081
        rate = parseFloat(args[0]);                                                                                // 1082
        id = parseInt(args[1], 10);                                                                                // 1083
      }                                                                                                            // 1084
                                                                                                                   // 1085
      // Update the playback rate or return the current value.                                                     // 1086
      var sound;                                                                                                   // 1087
      if (typeof rate === 'number') {                                                                              // 1088
        // Wait for the sound to load before changing the playback rate.                                           // 1089
        if (!self._loaded) {                                                                                       // 1090
          self.once('load', function() {                                                                           // 1091
            self.rate.apply(self, args);                                                                           // 1092
          });                                                                                                      // 1093
                                                                                                                   // 1094
          return self;                                                                                             // 1095
        }                                                                                                          // 1096
                                                                                                                   // 1097
        // Set the group rate.                                                                                     // 1098
        if (typeof id === 'undefined') {                                                                           // 1099
          self._rate = rate;                                                                                       // 1100
        }                                                                                                          // 1101
                                                                                                                   // 1102
        // Update one or all volumes.                                                                              // 1103
        id = self._getSoundIds(id);                                                                                // 1104
        for (var i=0; i<id.length; i++) {                                                                          // 1105
          // Get the sound.                                                                                        // 1106
          sound = self._soundById(id[i]);                                                                          // 1107
                                                                                                                   // 1108
          if (sound) {                                                                                             // 1109
            sound._rate = rate;                                                                                    // 1110
                                                                                                                   // 1111
            // Change the playback rate.                                                                           // 1112
            if (self._webAudio && sound._node && sound._node.bufferSource) {                                       // 1113
              sound._node.bufferSource.playbackRate.value = rate;                                                  // 1114
            } else if (sound._node) {                                                                              // 1115
              sound._node.playbackRate = rate;                                                                     // 1116
            }                                                                                                      // 1117
                                                                                                                   // 1118
            // Reset the timers.                                                                                   // 1119
            var seek = self.seek(id[i]);                                                                           // 1120
            var duration = ((self._sprite[sound._sprite][0] + self._sprite[sound._sprite][1]) / 1000) - seek;      // 1121
            var timeout = (duration * 1000) / Math.abs(sound._rate);                                               // 1122
                                                                                                                   // 1123
            self._clearTimer(id[i]);                                                                               // 1124
            self._endTimers[id[i]] = setTimeout(self._ended.bind(self, sound), timeout);                           // 1125
          }                                                                                                        // 1126
        }                                                                                                          // 1127
      } else {                                                                                                     // 1128
        sound = self._soundById(id);                                                                               // 1129
        return sound ? sound._rate : self._rate;                                                                   // 1130
      }                                                                                                            // 1131
                                                                                                                   // 1132
      return self;                                                                                                 // 1133
    },                                                                                                             // 1134
                                                                                                                   // 1135
    /**                                                                                                            // 1136
     * Get/set the seek position of a sound. This method can optionally take 0, 1 or 2 arguments.                  // 1137
     *   seek() -> Returns the first sound node's current seek position.                                           // 1138
     *   seek(id) -> Returns the sound id's current seek position.                                                 // 1139
     *   seek(seek) -> Sets the seek position of the first sound node.                                             // 1140
     *   seek(seek, id) -> Sets the seek position of passed sound id.                                              // 1141
     * @return {Howl/Number} Returns self or the current seek position.                                            // 1142
     */                                                                                                            // 1143
    seek: function() {                                                                                             // 1144
      var self = this;                                                                                             // 1145
      var args = arguments;                                                                                        // 1146
      var seek, id;                                                                                                // 1147
                                                                                                                   // 1148
      // Determine the values based on arguments.                                                                  // 1149
      if (args.length === 0) {                                                                                     // 1150
        // We will simply return the current position of the first node.                                           // 1151
        id = self._sounds[0]._id;                                                                                  // 1152
      } else if (args.length === 1) {                                                                              // 1153
        // First check if this is an ID, and if not, assume it is a new seek position.                             // 1154
        var ids = self._getSoundIds();                                                                             // 1155
        var index = ids.indexOf(args[0]);                                                                          // 1156
        if (index >= 0) {                                                                                          // 1157
          id = parseInt(args[0], 10);                                                                              // 1158
        } else {                                                                                                   // 1159
          id = self._sounds[0]._id;                                                                                // 1160
          seek = parseFloat(args[0]);                                                                              // 1161
        }                                                                                                          // 1162
      } else if (args.length === 2) {                                                                              // 1163
        seek = parseFloat(args[0]);                                                                                // 1164
        id = parseInt(args[1], 10);                                                                                // 1165
      }                                                                                                            // 1166
                                                                                                                   // 1167
      // If there is no ID, bail out.                                                                              // 1168
      if (typeof id === 'undefined') {                                                                             // 1169
        return self;                                                                                               // 1170
      }                                                                                                            // 1171
                                                                                                                   // 1172
      // Wait for the sound to load before seeking it.                                                             // 1173
      if (!self._loaded) {                                                                                         // 1174
        self.once('load', function() {                                                                             // 1175
          self.seek.apply(self, args);                                                                             // 1176
        });                                                                                                        // 1177
                                                                                                                   // 1178
        return self;                                                                                               // 1179
      }                                                                                                            // 1180
                                                                                                                   // 1181
      // Get the sound.                                                                                            // 1182
      var sound = self._soundById(id);                                                                             // 1183
                                                                                                                   // 1184
      if (sound) {                                                                                                 // 1185
        if (seek >= 0) {                                                                                           // 1186
          // Pause the sound and update position for restarting playback.                                          // 1187
          var playing = self.playing(id);                                                                          // 1188
          if (playing) {                                                                                           // 1189
            self.pause(id, true);                                                                                  // 1190
          }                                                                                                        // 1191
                                                                                                                   // 1192
          // Move the position of the track and cancel timer.                                                      // 1193
          sound._seek = seek;                                                                                      // 1194
          self._clearTimer(id);                                                                                    // 1195
                                                                                                                   // 1196
          // Restart the playback if the sound was playing.                                                        // 1197
          if (playing) {                                                                                           // 1198
            self.play(id, true);                                                                                   // 1199
          }                                                                                                        // 1200
        } else {                                                                                                   // 1201
          if (self._webAudio) {                                                                                    // 1202
            return (sound._seek + (self.playing(id) ? ctx.currentTime - sound._playStart : 0));                    // 1203
          } else {                                                                                                 // 1204
            return sound._node.currentTime;                                                                        // 1205
          }                                                                                                        // 1206
        }                                                                                                          // 1207
      }                                                                                                            // 1208
                                                                                                                   // 1209
      return self;                                                                                                 // 1210
    },                                                                                                             // 1211
                                                                                                                   // 1212
    /**                                                                                                            // 1213
     * Check if a specific sound is currently playing or not.                                                      // 1214
     * @param  {Number} id The sound id to check. If none is passed, first sound is used.                          // 1215
     * @return {Boolean}    True if playing and false if not.                                                      // 1216
     */                                                                                                            // 1217
    playing: function(id) {                                                                                        // 1218
      var self = this;                                                                                             // 1219
      var sound = self._soundById(id) || self._sounds[0];                                                          // 1220
                                                                                                                   // 1221
      return sound ? !sound._paused : false;                                                                       // 1222
    },                                                                                                             // 1223
                                                                                                                   // 1224
    /**                                                                                                            // 1225
     * Get the duration of this sound.                                                                             // 1226
     * @return {Number} Audio duration.                                                                            // 1227
     */                                                                                                            // 1228
    duration: function() {                                                                                         // 1229
      return this._duration;                                                                                       // 1230
    },                                                                                                             // 1231
                                                                                                                   // 1232
    /**                                                                                                            // 1233
     * Unload and destroy the current Howl object.                                                                 // 1234
     * This will immediately stop all sound instances attached to this group.                                      // 1235
     */                                                                                                            // 1236
    unload: function() {                                                                                           // 1237
      var self = this;                                                                                             // 1238
                                                                                                                   // 1239
      // Stop playing any active sounds.                                                                           // 1240
      var sounds = self._sounds;                                                                                   // 1241
      for (var i=0; i<sounds.length; i++) {                                                                        // 1242
        // Stop the sound if it is currently playing.                                                              // 1243
        if (!sounds[i]._paused) {                                                                                  // 1244
          self.stop(sounds[i]._id);                                                                                // 1245
          self._emit('end', sounds[i]._id);                                                                        // 1246
        }                                                                                                          // 1247
                                                                                                                   // 1248
        // Remove the source or disconnect.                                                                        // 1249
        if (!self._webAudio) {                                                                                     // 1250
          // Set the source to an empty string to stop any downloading.                                            // 1251
          sounds[i]._node.src = '';                                                                                // 1252
                                                                                                                   // 1253
          // Remove any event listeners.                                                                           // 1254
          sounds[i]._node.removeEventListener('error', sounds[i]._errorFn, false);                                 // 1255
          sounds[i]._node.removeEventListener(canPlayEvent, sounds[i]._loadFn, false);                             // 1256
        }                                                                                                          // 1257
                                                                                                                   // 1258
        // Empty out all of the nodes.                                                                             // 1259
        delete sounds[i]._node;                                                                                    // 1260
                                                                                                                   // 1261
        // Make sure all timers are cleared out.                                                                   // 1262
        self._clearTimer(sounds[i]._id);                                                                           // 1263
                                                                                                                   // 1264
        // Remove the references in the global Howler object.                                                      // 1265
        var index = Howler._howls.indexOf(self);                                                                   // 1266
        if (index >= 0) {                                                                                          // 1267
          Howler._howls.splice(index, 1);                                                                          // 1268
        }                                                                                                          // 1269
      }                                                                                                            // 1270
                                                                                                                   // 1271
      // Delete this sound from the cache.                                                                         // 1272
      if (cache) {                                                                                                 // 1273
        delete cache[self._src];                                                                                   // 1274
      }                                                                                                            // 1275
                                                                                                                   // 1276
      // Clear out `self`.                                                                                         // 1277
      self._sounds = [];                                                                                           // 1278
      self = null;                                                                                                 // 1279
                                                                                                                   // 1280
      return null;                                                                                                 // 1281
    },                                                                                                             // 1282
                                                                                                                   // 1283
    /**                                                                                                            // 1284
     * Listen to a custom event.                                                                                   // 1285
     * @param  {String}   event Event name.                                                                        // 1286
     * @param  {Function} fn    Listener to call.                                                                  // 1287
     * @param  {Number}   id    (optional) Only listen to events for this sound.                                   // 1288
     * @param  {Number}   once  (INTERNAL) Marks event to fire only once.                                          // 1289
     * @return {Howl}                                                                                              // 1290
     */                                                                                                            // 1291
    on: function(event, fn, id, once) {                                                                            // 1292
      var self = this;                                                                                             // 1293
      var events = self['_on' + event];                                                                            // 1294
                                                                                                                   // 1295
      if (typeof fn === 'function') {                                                                              // 1296
        events.push(once ? {id: id, fn: fn, once: once} : {id: id, fn: fn});                                       // 1297
      }                                                                                                            // 1298
                                                                                                                   // 1299
      return self;                                                                                                 // 1300
    },                                                                                                             // 1301
                                                                                                                   // 1302
    /**                                                                                                            // 1303
     * Remove a custom event. Call without parameters to remove all events.                                        // 1304
     * @param  {String}   event Event name.                                                                        // 1305
     * @param  {Function} fn    Listener to remove. Leave empty to remove all.                                     // 1306
     * @param  {Number}   id    (optional) Only remove events for this sound.                                      // 1307
     * @return {Howl}                                                                                              // 1308
     */                                                                                                            // 1309
    off: function(event, fn, id) {                                                                                 // 1310
      var self = this;                                                                                             // 1311
      var events = self['_on' + event];                                                                            // 1312
                                                                                                                   // 1313
      if (fn) {                                                                                                    // 1314
        // Loop through event store and remove the passed function.                                                // 1315
        for (var i=0; i<events.length; i++) {                                                                      // 1316
          if (fn === events[i].fn && id === events[i].id) {                                                        // 1317
            events.splice(i, 1);                                                                                   // 1318
            break;                                                                                                 // 1319
          }                                                                                                        // 1320
        }                                                                                                          // 1321
      } else if (event) {                                                                                          // 1322
        // Clear out all events of this type.                                                                      // 1323
        self['_on' + event] = [];                                                                                  // 1324
      } else {                                                                                                     // 1325
        // Clear out all events of every type.                                                                     // 1326
        var keys = Object.keys(self);                                                                              // 1327
        for (var i=0; i<keys.length; i++) {                                                                        // 1328
          if ((keys[i].indexOf('_on') === 0) && Array.isArray(self[keys[i]])) {                                    // 1329
            self[keys[i]] = [];                                                                                    // 1330
          }                                                                                                        // 1331
        }                                                                                                          // 1332
      }                                                                                                            // 1333
                                                                                                                   // 1334
      return self;                                                                                                 // 1335
    },                                                                                                             // 1336
                                                                                                                   // 1337
    /**                                                                                                            // 1338
     * Listen to a custom event and remove it once fired.                                                          // 1339
     * @param  {String}   event Event name.                                                                        // 1340
     * @param  {Function} fn    Listener to call.                                                                  // 1341
     * @param  {Number}   id    (optional) Only listen to events for this sound.                                   // 1342
     * @return {Howl}                                                                                              // 1343
     */                                                                                                            // 1344
    once: function(event, fn, id) {                                                                                // 1345
      var self = this;                                                                                             // 1346
                                                                                                                   // 1347
      // Setup the event listener.                                                                                 // 1348
      self.on(event, fn, id, 1);                                                                                   // 1349
                                                                                                                   // 1350
      return self;                                                                                                 // 1351
    },                                                                                                             // 1352
                                                                                                                   // 1353
    /**                                                                                                            // 1354
     * Emit all events of a specific type and pass the sound id.                                                   // 1355
     * @param  {String} event Event name.                                                                          // 1356
     * @param  {Number} id    Sound ID.                                                                            // 1357
     * @param  {Number} msg   Message to go with event.                                                            // 1358
     * @return {Howl}                                                                                              // 1359
     */                                                                                                            // 1360
    _emit: function(event, id, msg) {                                                                              // 1361
      var self = this;                                                                                             // 1362
      var events = self['_on' + event];                                                                            // 1363
                                                                                                                   // 1364
      // Loop through event store and fire all functions.                                                          // 1365
      for (var i=0; i<events.length; i++) {                                                                        // 1366
        if (!events[i].id || events[i].id === id) {                                                                // 1367
          setTimeout(function(fn) {                                                                                // 1368
            fn.call(this, id, msg);                                                                                // 1369
          }.bind(self, events[i].fn), 0);                                                                          // 1370
                                                                                                                   // 1371
          // If this event was setup with `once`, remove it.                                                       // 1372
          if (events[i].once) {                                                                                    // 1373
            self.off(event, events[i].fn, events[i].id);                                                           // 1374
          }                                                                                                        // 1375
        }                                                                                                          // 1376
      }                                                                                                            // 1377
                                                                                                                   // 1378
      return self;                                                                                                 // 1379
    },                                                                                                             // 1380
                                                                                                                   // 1381
    /**                                                                                                            // 1382
     * Fired when playback ends at the end of the duration.                                                        // 1383
     * @param  {Sound} sound The sound object to work with.                                                        // 1384
     * @return {Howl}                                                                                              // 1385
     */                                                                                                            // 1386
    _ended: function(sound) {                                                                                      // 1387
      var self = this;                                                                                             // 1388
      var sprite = sound._sprite;                                                                                  // 1389
                                                                                                                   // 1390
      // Should this sound loop?                                                                                   // 1391
      var loop = !!(sound._loop || self._sprite[sprite][2]);                                                       // 1392
                                                                                                                   // 1393
      // Fire the ended event.                                                                                     // 1394
      self._emit('end', sound._id);                                                                                // 1395
                                                                                                                   // 1396
      // Restart the playback for HTML5 Audio loop.                                                                // 1397
      if (!self._webAudio && loop) {                                                                               // 1398
        self.stop(sound._id).play(sound._id);                                                                      // 1399
      }                                                                                                            // 1400
                                                                                                                   // 1401
      // Restart this timer if on a Web Audio loop.                                                                // 1402
      if (self._webAudio && loop) {                                                                                // 1403
        self._emit('play', sound._id);                                                                             // 1404
        sound._seek = sound._start || 0;                                                                           // 1405
        sound._playStart = ctx.currentTime;                                                                        // 1406
                                                                                                                   // 1407
        var timeout = ((sound._stop - sound._start) * 1000) / Math.abs(sound._rate);                               // 1408
        self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);                           // 1409
      }                                                                                                            // 1410
                                                                                                                   // 1411
      // Mark the node as paused.                                                                                  // 1412
      if (self._webAudio && !loop) {                                                                               // 1413
        sound._paused = true;                                                                                      // 1414
        sound._ended = true;                                                                                       // 1415
        sound._seek = sound._start || 0;                                                                           // 1416
        self._clearTimer(sound._id);                                                                               // 1417
                                                                                                                   // 1418
        // Clean up the buffer source.                                                                             // 1419
        sound._node.bufferSource = null;                                                                           // 1420
                                                                                                                   // 1421
        // Attempt to auto-suspend AudioContext if no sounds are still playing.                                    // 1422
        Howler._autoSuspend();                                                                                     // 1423
      }                                                                                                            // 1424
                                                                                                                   // 1425
      // When using a sprite, end the track.                                                                       // 1426
      if (!self._webAudio && !loop) {                                                                              // 1427
        self.stop(sound._id);                                                                                      // 1428
      }                                                                                                            // 1429
                                                                                                                   // 1430
      return self;                                                                                                 // 1431
    },                                                                                                             // 1432
                                                                                                                   // 1433
    /**                                                                                                            // 1434
     * Clear the end timer for a sound playback.                                                                   // 1435
     * @param  {Number} id The sound ID.                                                                           // 1436
     * @return {Howl}                                                                                              // 1437
     */                                                                                                            // 1438
    _clearTimer: function(id) {                                                                                    // 1439
      var self = this;                                                                                             // 1440
                                                                                                                   // 1441
      if (self._endTimers[id]) {                                                                                   // 1442
        clearTimeout(self._endTimers[id]);                                                                         // 1443
        delete self._endTimers[id];                                                                                // 1444
      }                                                                                                            // 1445
                                                                                                                   // 1446
      return self;                                                                                                 // 1447
    },                                                                                                             // 1448
                                                                                                                   // 1449
    /**                                                                                                            // 1450
     * Return the sound identified by this ID, or return null.                                                     // 1451
     * @param  {Number} id Sound ID                                                                                // 1452
     * @return {Object}    Sound object or null.                                                                   // 1453
     */                                                                                                            // 1454
    _soundById: function(id) {                                                                                     // 1455
      var self = this;                                                                                             // 1456
                                                                                                                   // 1457
      // Loop through all sounds and find the one with this ID.                                                    // 1458
      for (var i=0; i<self._sounds.length; i++) {                                                                  // 1459
        if (id === self._sounds[i]._id) {                                                                          // 1460
          return self._sounds[i];                                                                                  // 1461
        }                                                                                                          // 1462
      }                                                                                                            // 1463
                                                                                                                   // 1464
      return null;                                                                                                 // 1465
    },                                                                                                             // 1466
                                                                                                                   // 1467
    /**                                                                                                            // 1468
     * Return an inactive sound from the pool or create a new one.                                                 // 1469
     * @return {Sound} Sound playback object.                                                                      // 1470
     */                                                                                                            // 1471
    _inactiveSound: function() {                                                                                   // 1472
      var self = this;                                                                                             // 1473
                                                                                                                   // 1474
      self._drain();                                                                                               // 1475
                                                                                                                   // 1476
      // Find the first inactive node to recycle.                                                                  // 1477
      for (var i=0; i<self._sounds.length; i++) {                                                                  // 1478
        if (self._sounds[i]._ended) {                                                                              // 1479
          return self._sounds[i].reset();                                                                          // 1480
        }                                                                                                          // 1481
      }                                                                                                            // 1482
                                                                                                                   // 1483
      // If no inactive node was found, create a new one.                                                          // 1484
      return new Sound(self);                                                                                      // 1485
    },                                                                                                             // 1486
                                                                                                                   // 1487
    /**                                                                                                            // 1488
     * Drain excess inactive sounds from the pool.                                                                 // 1489
     */                                                                                                            // 1490
    _drain: function() {                                                                                           // 1491
      var self = this;                                                                                             // 1492
      var limit = self._pool;                                                                                      // 1493
      var cnt = 0;                                                                                                 // 1494
      var i = 0;                                                                                                   // 1495
                                                                                                                   // 1496
      // If there are less sounds than the max pool size, we are done.                                             // 1497
      if (self._sounds.length < limit) {                                                                           // 1498
        return;                                                                                                    // 1499
      }                                                                                                            // 1500
                                                                                                                   // 1501
      // Count the number of inactive sounds.                                                                      // 1502
      for (i=0; i<self._sounds.length; i++) {                                                                      // 1503
        if (self._sounds[i]._ended) {                                                                              // 1504
          cnt++;                                                                                                   // 1505
        }                                                                                                          // 1506
      }                                                                                                            // 1507
                                                                                                                   // 1508
      // Remove excess inactive sounds, going in reverse order.                                                    // 1509
      for (i=self._sounds.length - 1; i>=0; i--) {                                                                 // 1510
        if (cnt <= limit) {                                                                                        // 1511
          return;                                                                                                  // 1512
        }                                                                                                          // 1513
                                                                                                                   // 1514
        if (self._sounds[i]._ended) {                                                                              // 1515
          // Disconnect the audio source when using Web Audio.                                                     // 1516
          if (self._webAudio && self._sounds[i]._node) {                                                           // 1517
            self._sounds[i]._node.disconnect(0);                                                                   // 1518
          }                                                                                                        // 1519
                                                                                                                   // 1520
          // Remove sounds until we have the pool size.                                                            // 1521
          self._sounds.splice(i, 1);                                                                               // 1522
          cnt--;                                                                                                   // 1523
        }                                                                                                          // 1524
      }                                                                                                            // 1525
    },                                                                                                             // 1526
                                                                                                                   // 1527
    /**                                                                                                            // 1528
     * Get all ID's from the sounds pool.                                                                          // 1529
     * @param  {Number} id Only return one ID if one is passed.                                                    // 1530
     * @return {Array}    Array of IDs.                                                                            // 1531
     */                                                                                                            // 1532
    _getSoundIds: function(id) {                                                                                   // 1533
      var self = this;                                                                                             // 1534
                                                                                                                   // 1535
      if (typeof id === 'undefined') {                                                                             // 1536
        var ids = [];                                                                                              // 1537
        for (var i=0; i<self._sounds.length; i++) {                                                                // 1538
          ids.push(self._sounds[i]._id);                                                                           // 1539
        }                                                                                                          // 1540
                                                                                                                   // 1541
        return ids;                                                                                                // 1542
      } else {                                                                                                     // 1543
        return [id];                                                                                               // 1544
      }                                                                                                            // 1545
    },                                                                                                             // 1546
                                                                                                                   // 1547
    /**                                                                                                            // 1548
     * Load the sound back into the buffer source.                                                                 // 1549
     * @param  {Sound} sound The sound object to work with.                                                        // 1550
     * @return {Howl}                                                                                              // 1551
     */                                                                                                            // 1552
    _refreshBuffer: function(sound) {                                                                              // 1553
      var self = this;                                                                                             // 1554
                                                                                                                   // 1555
      // Setup the buffer source for playback.                                                                     // 1556
      sound._node.bufferSource = ctx.createBufferSource();                                                         // 1557
      sound._node.bufferSource.buffer = cache[self._src];                                                          // 1558
                                                                                                                   // 1559
      // Connect to the correct node.                                                                              // 1560
      if (sound._panner) {                                                                                         // 1561
        sound._node.bufferSource.connect(sound._panner);                                                           // 1562
      } else {                                                                                                     // 1563
        sound._node.bufferSource.connect(sound._node);                                                             // 1564
      }                                                                                                            // 1565
                                                                                                                   // 1566
      // Setup looping and playback rate.                                                                          // 1567
      sound._node.bufferSource.loop = sound._loop;                                                                 // 1568
      if (sound._loop) {                                                                                           // 1569
        sound._node.bufferSource.loopStart = sound._start || 0;                                                    // 1570
        sound._node.bufferSource.loopEnd = sound._stop;                                                            // 1571
      }                                                                                                            // 1572
      sound._node.bufferSource.playbackRate.value = self._rate;                                                    // 1573
                                                                                                                   // 1574
      return self;                                                                                                 // 1575
    }                                                                                                              // 1576
  };                                                                                                               // 1577
                                                                                                                   // 1578
  /** Single Sound Methods **/                                                                                     // 1579
  /***************************************************************************/                                    // 1580
                                                                                                                   // 1581
  /**                                                                                                              // 1582
   * Setup the sound object, which each node attached to a Howl group is contained in.                             // 1583
   * @param {Object} howl The Howl parent group.                                                                   // 1584
   */                                                                                                              // 1585
  var Sound = function(howl) {                                                                                     // 1586
    this._parent = howl;                                                                                           // 1587
    this.init();                                                                                                   // 1588
  };                                                                                                               // 1589
  Sound.prototype = {                                                                                              // 1590
    /**                                                                                                            // 1591
     * Initialize a new Sound object.                                                                              // 1592
     * @return {Sound}                                                                                             // 1593
     */                                                                                                            // 1594
    init: function() {                                                                                             // 1595
      var self = this;                                                                                             // 1596
      var parent = self._parent;                                                                                   // 1597
                                                                                                                   // 1598
      // Setup the default parameters.                                                                             // 1599
      self._muted = parent._muted;                                                                                 // 1600
      self._loop = parent._loop;                                                                                   // 1601
      self._volume = parent._volume;                                                                               // 1602
      self._muted = parent._muted;                                                                                 // 1603
      self._rate = parent._rate;                                                                                   // 1604
      self._seek = 0;                                                                                              // 1605
      self._paused = true;                                                                                         // 1606
      self._ended = true;                                                                                          // 1607
      self._sprite = '__default';                                                                                  // 1608
                                                                                                                   // 1609
      // Generate a unique ID for this sound.                                                                      // 1610
      self._id = Math.round(Date.now() * Math.random());                                                           // 1611
                                                                                                                   // 1612
      // Add itself to the parent's pool.                                                                          // 1613
      parent._sounds.push(self);                                                                                   // 1614
                                                                                                                   // 1615
      // Create the new node.                                                                                      // 1616
      self.create();                                                                                               // 1617
                                                                                                                   // 1618
      return self;                                                                                                 // 1619
    },                                                                                                             // 1620
                                                                                                                   // 1621
    /**                                                                                                            // 1622
     * Create and setup a new sound object, whether HTML5 Audio or Web Audio.                                      // 1623
     * @return {Sound}                                                                                             // 1624
     */                                                                                                            // 1625
    create: function() {                                                                                           // 1626
      var self = this;                                                                                             // 1627
      var parent = self._parent;                                                                                   // 1628
      var volume = (Howler._muted || self._muted || self._parent._muted) ? 0 : self._volume * Howler.volume();     // 1629
                                                                                                                   // 1630
      if (parent._webAudio) {                                                                                      // 1631
        // Create the gain node for controlling volume (the source will connect to this).                          // 1632
        self._node = (typeof ctx.createGain === 'undefined') ? ctx.createGainNode() : ctx.createGain();            // 1633
        self._node.gain.setValueAtTime(volume, ctx.currentTime);                                                   // 1634
        self._node.paused = true;                                                                                  // 1635
        self._node.connect(masterGain);                                                                            // 1636
      } else {                                                                                                     // 1637
        self._node = new Audio();                                                                                  // 1638
                                                                                                                   // 1639
        // Listen for errors (http://dev.w3.org/html5/spec-author-view/spec.html#mediaerror).                      // 1640
        self._errorFn = self._errorListener.bind(self);                                                            // 1641
        self._node.addEventListener('error', self._errorFn, false);                                                // 1642
                                                                                                                   // 1643
        // Listen for 'canplaythrough' event to let us know the sound is ready.                                    // 1644
        self._loadFn = self._loadListener.bind(self);                                                              // 1645
        self._node.addEventListener(canPlayEvent, self._loadFn, false);                                            // 1646
                                                                                                                   // 1647
        // Setup the new audio node.                                                                               // 1648
        self._node.src = parent._src;                                                                              // 1649
        self._node.preload = 'auto';                                                                               // 1650
        self._node.volume = volume;                                                                                // 1651
                                                                                                                   // 1652
        // Begin loading the source.                                                                               // 1653
        self._node.load();                                                                                         // 1654
      }                                                                                                            // 1655
                                                                                                                   // 1656
      return self;                                                                                                 // 1657
    },                                                                                                             // 1658
                                                                                                                   // 1659
    /**                                                                                                            // 1660
     * Reset the parameters of this sound to the original state (for recycle).                                     // 1661
     * @return {Sound}                                                                                             // 1662
     */                                                                                                            // 1663
    reset: function() {                                                                                            // 1664
      var self = this;                                                                                             // 1665
      var parent = self._parent;                                                                                   // 1666
                                                                                                                   // 1667
      // Reset all of the parameters of this sound.                                                                // 1668
      self._muted = parent._muted;                                                                                 // 1669
      self._loop = parent._loop;                                                                                   // 1670
      self._volume = parent._volume;                                                                               // 1671
      self._muted = parent._muted;                                                                                 // 1672
      self._rate = parent._rate;                                                                                   // 1673
      self._seek = 0;                                                                                              // 1674
      self._paused = true;                                                                                         // 1675
      self._ended = true;                                                                                          // 1676
      self._sprite = '__default';                                                                                  // 1677
                                                                                                                   // 1678
      // Generate a new ID so that it isn't confused with the previous sound.                                      // 1679
      self._id = Math.round(Date.now() * Math.random());                                                           // 1680
                                                                                                                   // 1681
      return self;                                                                                                 // 1682
    },                                                                                                             // 1683
                                                                                                                   // 1684
    /**                                                                                                            // 1685
     * HTML5 Audio error listener callback.                                                                        // 1686
     */                                                                                                            // 1687
    _errorListener: function() {                                                                                   // 1688
      var self = this;                                                                                             // 1689
                                                                                                                   // 1690
      if (self._node.error && self._node.error.code === 4) {                                                       // 1691
        Howler.noAudio = true;                                                                                     // 1692
      }                                                                                                            // 1693
                                                                                                                   // 1694
      // Fire an error event and pass back the code.                                                               // 1695
      self._parent._emit('loaderror', self._id, self._node.error ? self._node.error.code : 0);                     // 1696
                                                                                                                   // 1697
      // Clear the event listener.                                                                                 // 1698
      self._node.removeEventListener('error', self._errorListener, false);                                         // 1699
    },                                                                                                             // 1700
                                                                                                                   // 1701
    /**                                                                                                            // 1702
     * HTML5 Audio canplaythrough listener callback.                                                               // 1703
     */                                                                                                            // 1704
    _loadListener: function() {                                                                                    // 1705
      var self = this;                                                                                             // 1706
      var parent = self._parent;                                                                                   // 1707
                                                                                                                   // 1708
      // Round up the duration to account for the lower precision in HTML5 Audio.                                  // 1709
      parent._duration = Math.ceil(self._node.duration * 10) / 10;                                                 // 1710
                                                                                                                   // 1711
      // Setup a sprite if none is defined.                                                                        // 1712
      if (Object.keys(parent._sprite).length === 0) {                                                              // 1713
        parent._sprite = {__default: [0, parent._duration * 1000]};                                                // 1714
      }                                                                                                            // 1715
                                                                                                                   // 1716
      if (!parent._loaded) {                                                                                       // 1717
        parent._loaded = true;                                                                                     // 1718
        parent._emit('load');                                                                                      // 1719
      }                                                                                                            // 1720
                                                                                                                   // 1721
      if (parent._autoplay) {                                                                                      // 1722
        parent.play();                                                                                             // 1723
      }                                                                                                            // 1724
                                                                                                                   // 1725
      // Clear the event listener.                                                                                 // 1726
      self._node.removeEventListener(canPlayEvent, self._loadFn, false);                                           // 1727
    }                                                                                                              // 1728
  };                                                                                                               // 1729
                                                                                                                   // 1730
  /** Helper Methods **/                                                                                           // 1731
  /***************************************************************************/                                    // 1732
                                                                                                                   // 1733
  // Only define these methods when using Web Audio.                                                               // 1734
  if (usingWebAudio) {                                                                                             // 1735
                                                                                                                   // 1736
    var cache = {};                                                                                                // 1737
                                                                                                                   // 1738
    /**                                                                                                            // 1739
     * Buffer a sound from URL, Data URI or cache and decode to audio source (Web Audio API).                      // 1740
     * @param  {Howl} self                                                                                         // 1741
     */                                                                                                            // 1742
    var loadBuffer = function(self) {                                                                              // 1743
      var url = self._src;                                                                                         // 1744
                                                                                                                   // 1745
      // Check if the buffer has already been cached and use it instead.                                           // 1746
      if (cache[url]) {                                                                                            // 1747
        // Set the duration from the cache.                                                                        // 1748
        self._duration = cache[url].duration;                                                                      // 1749
                                                                                                                   // 1750
        // Load the sound into this Howl.                                                                          // 1751
        loadSound(self);                                                                                           // 1752
                                                                                                                   // 1753
        return;                                                                                                    // 1754
      }                                                                                                            // 1755
                                                                                                                   // 1756
      if (/^data:[^;]+;base64,/.test(url)) {                                                                       // 1757
        // Setup polyfill for window.atob to support IE9.                                                          // 1758
        // Modified from: https://github.com/davidchambers/Base64.js                                               // 1759
        window.atob = window.atob || function(input) {                                                             // 1760
          var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';                         // 1761
          var str = String(input).replace(/=+$/, '');                                                              // 1762
          for (                                                                                                    // 1763
            var bc = 0, bs, buffer, idx = 0, output = '';                                                          // 1764
            buffer = str.charAt(idx++);                                                                            // 1765
            ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
          ) {                                                                                                      // 1767
            buffer = chars.indexOf(buffer);                                                                        // 1768
          }                                                                                                        // 1769
                                                                                                                   // 1770
          return output;                                                                                           // 1771
        };                                                                                                         // 1772
                                                                                                                   // 1773
        // Decode the base64 data URI without XHR, since some browsers don't support it.                           // 1774
        var data = atob(url.split(',')[1]);                                                                        // 1775
        var dataView = new Uint8Array(data.length);                                                                // 1776
        for (var i=0; i<data.length; ++i) {                                                                        // 1777
          dataView[i] = data.charCodeAt(i);                                                                        // 1778
        }                                                                                                          // 1779
                                                                                                                   // 1780
        decodeAudioData(dataView.buffer, self);                                                                    // 1781
      } else {                                                                                                     // 1782
        // Load the buffer from the URL.                                                                           // 1783
        var xhr = new XMLHttpRequest();                                                                            // 1784
        xhr.open('GET', url, true);                                                                                // 1785
        xhr.responseType = 'arraybuffer';                                                                          // 1786
        xhr.onload = function() {                                                                                  // 1787
          decodeAudioData(xhr.response, self);                                                                     // 1788
        };                                                                                                         // 1789
        xhr.onerror = function() {                                                                                 // 1790
          // If there is an error, switch to HTML5 Audio.                                                          // 1791
          if (self._webAudio) {                                                                                    // 1792
            self._html5 = true;                                                                                    // 1793
            self._webAudio = false;                                                                                // 1794
            self._sounds = [];                                                                                     // 1795
            delete cache[url];                                                                                     // 1796
            self.load();                                                                                           // 1797
          }                                                                                                        // 1798
        };                                                                                                         // 1799
        safeXhrSend(xhr);                                                                                          // 1800
      }                                                                                                            // 1801
    };                                                                                                             // 1802
                                                                                                                   // 1803
    /**                                                                                                            // 1804
     * Send the XHR request wrapped in a try/catch.                                                                // 1805
     * @param  {Object} xhr XHR to send.                                                                           // 1806
     */                                                                                                            // 1807
    var safeXhrSend = function(xhr) {                                                                              // 1808
      try {                                                                                                        // 1809
        xhr.send();                                                                                                // 1810
      } catch (e) {                                                                                                // 1811
        xhr.onerror();                                                                                             // 1812
      }                                                                                                            // 1813
    };                                                                                                             // 1814
                                                                                                                   // 1815
    /**                                                                                                            // 1816
     * Decode audio data from an array buffer.                                                                     // 1817
     * @param  {ArrayBuffer} arraybuffer The audio data.                                                           // 1818
     * @param  {Howl}        self                                                                                  // 1819
     */                                                                                                            // 1820
    var decodeAudioData = function(arraybuffer, self) {                                                            // 1821
      // Decode the buffer into an audio source.                                                                   // 1822
      ctx.decodeAudioData(arraybuffer, function(buffer) {                                                          // 1823
        if (buffer && self._sounds.length > 0) {                                                                   // 1824
          cache[self._src] = buffer;                                                                               // 1825
          loadSound(self, buffer);                                                                                 // 1826
        }                                                                                                          // 1827
      }, function() {                                                                                              // 1828
        self._emit('loaderror', null, 'Decoding audio data failed.');                                              // 1829
      });                                                                                                          // 1830
    };                                                                                                             // 1831
                                                                                                                   // 1832
    /**                                                                                                            // 1833
     * Sound is now loaded, so finish setting everything up and fire the loaded event.                             // 1834
     * @param  {Howl} self                                                                                         // 1835
     * @param  {Object} buffer The decoded buffer sound source.                                                    // 1836
     */                                                                                                            // 1837
    var loadSound = function(self, buffer) {                                                                       // 1838
      // Set the duration.                                                                                         // 1839
      if (buffer && !self._duration) {                                                                             // 1840
        self._duration = buffer.duration;                                                                          // 1841
      }                                                                                                            // 1842
                                                                                                                   // 1843
      // Setup a sprite if none is defined.                                                                        // 1844
      if (Object.keys(self._sprite).length === 0) {                                                                // 1845
        self._sprite = {__default: [0, self._duration * 1000]};                                                    // 1846
      }                                                                                                            // 1847
                                                                                                                   // 1848
      // Fire the loaded event.                                                                                    // 1849
      if (!self._loaded) {                                                                                         // 1850
        self._loaded = true;                                                                                       // 1851
        self._emit('load');                                                                                        // 1852
      }                                                                                                            // 1853
                                                                                                                   // 1854
      // Begin playback if specified.                                                                              // 1855
      if (self._autoplay) {                                                                                        // 1856
        self.play();                                                                                               // 1857
      }                                                                                                            // 1858
    };                                                                                                             // 1859
                                                                                                                   // 1860
  }                                                                                                                // 1861
                                                                                                                   // 1862
  /**                                                                                                              // 1863
   * Setup the audio context when available, or switch to HTML5 Audio mode.                                        // 1864
   */                                                                                                              // 1865
  function setupAudioContext() {                                                                                   // 1866
    try {                                                                                                          // 1867
      if (typeof AudioContext !== 'undefined') {                                                                   // 1868
        ctx = new AudioContext();                                                                                  // 1869
      } else if (typeof webkitAudioContext !== 'undefined') {                                                      // 1870
        ctx = new webkitAudioContext();                                                                            // 1871
      } else {                                                                                                     // 1872
        usingWebAudio = false;                                                                                     // 1873
      }                                                                                                            // 1874
    } catch(e) {                                                                                                   // 1875
      usingWebAudio = false;                                                                                       // 1876
    }                                                                                                              // 1877
                                                                                                                   // 1878
    if (!usingWebAudio) {                                                                                          // 1879
      if (typeof Audio !== 'undefined') {                                                                          // 1880
        try {                                                                                                      // 1881
          var test = new Audio();                                                                                  // 1882
                                                                                                                   // 1883
          // Check if the canplaythrough event is available.                                                       // 1884
          if (typeof test.oncanplaythrough === 'undefined') {                                                      // 1885
            canPlayEvent = 'canplay';                                                                              // 1886
          }                                                                                                        // 1887
        } catch(e) {                                                                                               // 1888
          noAudio = true;                                                                                          // 1889
        }                                                                                                          // 1890
      } else {                                                                                                     // 1891
        noAudio = true;                                                                                            // 1892
      }                                                                                                            // 1893
    }                                                                                                              // 1894
                                                                                                                   // 1895
    // Test to make sure audio isn't disabled in Internet Explorer                                                 // 1896
    try {                                                                                                          // 1897
      var test = new Audio();                                                                                      // 1898
      if (test.muted) {                                                                                            // 1899
        noAudio = true;                                                                                            // 1900
      }                                                                                                            // 1901
    } catch (e) {}                                                                                                 // 1902
                                                                                                                   // 1903
    // Create a master gain node.                                                                                  // 1904
    if (usingWebAudio) {                                                                                           // 1905
      masterGain = (typeof ctx.createGain === 'undefined') ? ctx.createGainNode() : ctx.createGain();              // 1906
      masterGain.gain.value = 1;                                                                                   // 1907
      masterGain.connect(ctx.destination);                                                                         // 1908
    }                                                                                                              // 1909
  }                                                                                                                // 1910
                                                                                                                   // 1911
  // Add support for AMD (Asynchronous Module Definition) libraries such as require.js.                            // 1912
  if (typeof define === 'function' && define.amd) {                                                                // 1913
    define([], function() {                                                                                        // 1914
      return {                                                                                                     // 1915
        Howler: Howler,                                                                                            // 1916
        Howl: Howl                                                                                                 // 1917
      };                                                                                                           // 1918
    });                                                                                                            // 1919
  }                                                                                                                // 1920
                                                                                                                   // 1921
  // Add support for CommonJS libraries such as browserify.                                                        // 1922
  if (typeof exports !== 'undefined') {                                                                            // 1923
    exports.Howler = Howler;                                                                                       // 1924
    exports.Howl = Howl;                                                                                           // 1925
  }                                                                                                                // 1926
                                                                                                                   // 1927
  // Define globally in case AMD is not available or unused.                                                       // 1928
  if (typeof window !== 'undefined') {                                                                             // 1929
    window.HowlerGlobal = HowlerGlobal;                                                                            // 1930
    window.Howler = Howler;                                                                                        // 1931
    window.Howl = Howl;                                                                                            // 1932
    window.Sound = Sound;                                                                                          // 1933
  }                                                                                                                // 1934
})();                                                                                                              // 1935
                                                                                                                   // 1936
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/bojicas:howler2/after.js                                                                               //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
Howler = exports.Howler;                                                                                           // 1
Howl = exports.Howl;                                                                                               // 2
                                                                                                                   // 3
// Cleanup.                                                                                                        // 4
delete window.HowlerGlobal;                                                                                        // 5
delete window.Howler;                                                                                              // 6
delete window.Howl;                                                                                                // 7
delete window.Sound;                                                                                               // 8
                                                                                                                   // 9
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);
