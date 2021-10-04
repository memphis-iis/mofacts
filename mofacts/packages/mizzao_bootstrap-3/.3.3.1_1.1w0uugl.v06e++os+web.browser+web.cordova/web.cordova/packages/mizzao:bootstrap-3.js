(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mizzao:bootstrap-3/bootstrap-3/js/bootstrap.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/*!                                                                                                                    // 1
 * Bootstrap v3.3.1 (http://getbootstrap.com)                                                                          // 2
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 3
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 4
 */                                                                                                                    // 5
                                                                                                                       // 6
if (typeof jQuery === 'undefined') {                                                                                   // 7
  throw new Error('Bootstrap\'s JavaScript requires jQuery')                                                           // 8
}                                                                                                                      // 9
                                                                                                                       // 10
+function ($) {                                                                                                        // 11
  var version = $.fn.jquery.split(' ')[0].split('.')                                                                   // 12
  if ((version[0] < 2 && version[1] < 9) || (version[0] == 1 && version[1] == 9 && version[2] < 1)) {                  // 13
    throw new Error('Bootstrap\'s JavaScript requires jQuery version 1.9.1 or higher')                                 // 14
  }                                                                                                                    // 15
}(jQuery);                                                                                                             // 16
                                                                                                                       // 17
/* ========================================================================                                            // 18
 * Bootstrap: transition.js v3.3.1                                                                                     // 19
 * http://getbootstrap.com/javascript/#transitions                                                                     // 20
 * ========================================================================                                            // 21
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 22
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 23
 * ======================================================================== */                                         // 24
                                                                                                                       // 25
                                                                                                                       // 26
+function ($) {                                                                                                        // 27
  'use strict';                                                                                                        // 28
                                                                                                                       // 29
  // CSS TRANSITION SUPPORT (Shoutout: http://www.modernizr.com/)                                                      // 30
  // ============================================================                                                      // 31
                                                                                                                       // 32
  function transitionEnd() {                                                                                           // 33
    var el = document.createElement('bootstrap')                                                                       // 34
                                                                                                                       // 35
    var transEndEventNames = {                                                                                         // 36
      WebkitTransition : 'webkitTransitionEnd',                                                                        // 37
      MozTransition    : 'transitionend',                                                                              // 38
      OTransition      : 'oTransitionEnd otransitionend',                                                              // 39
      transition       : 'transitionend'                                                                               // 40
    }                                                                                                                  // 41
                                                                                                                       // 42
    for (var name in transEndEventNames) {                                                                             // 43
      if (el.style[name] !== undefined) {                                                                              // 44
        return { end: transEndEventNames[name] }                                                                       // 45
      }                                                                                                                // 46
    }                                                                                                                  // 47
                                                                                                                       // 48
    return false // explicit for ie8 (  ._.)                                                                           // 49
  }                                                                                                                    // 50
                                                                                                                       // 51
  // http://blog.alexmaccaw.com/css-transitions                                                                        // 52
  $.fn.emulateTransitionEnd = function (duration) {                                                                    // 53
    var called = false                                                                                                 // 54
    var $el = this                                                                                                     // 55
    $(this).one('bsTransitionEnd', function () { called = true })                                                      // 56
    var callback = function () { if (!called) $($el).trigger($.support.transition.end) }                               // 57
    setTimeout(callback, duration)                                                                                     // 58
    return this                                                                                                        // 59
  }                                                                                                                    // 60
                                                                                                                       // 61
  $(function () {                                                                                                      // 62
    $.support.transition = transitionEnd()                                                                             // 63
                                                                                                                       // 64
    if (!$.support.transition) return                                                                                  // 65
                                                                                                                       // 66
    $.event.special.bsTransitionEnd = {                                                                                // 67
      bindType: $.support.transition.end,                                                                              // 68
      delegateType: $.support.transition.end,                                                                          // 69
      handle: function (e) {                                                                                           // 70
        if ($(e.target).is(this)) return e.handleObj.handler.apply(this, arguments)                                    // 71
      }                                                                                                                // 72
    }                                                                                                                  // 73
  })                                                                                                                   // 74
                                                                                                                       // 75
}(jQuery);                                                                                                             // 76
                                                                                                                       // 77
/* ========================================================================                                            // 78
 * Bootstrap: alert.js v3.3.1                                                                                          // 79
 * http://getbootstrap.com/javascript/#alerts                                                                          // 80
 * ========================================================================                                            // 81
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 82
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 83
 * ======================================================================== */                                         // 84
                                                                                                                       // 85
                                                                                                                       // 86
+function ($) {                                                                                                        // 87
  'use strict';                                                                                                        // 88
                                                                                                                       // 89
  // ALERT CLASS DEFINITION                                                                                            // 90
  // ======================                                                                                            // 91
                                                                                                                       // 92
  var dismiss = '[data-dismiss="alert"]'                                                                               // 93
  var Alert   = function (el) {                                                                                        // 94
    $(el).on('click', dismiss, this.close)                                                                             // 95
  }                                                                                                                    // 96
                                                                                                                       // 97
  Alert.VERSION = '3.3.1'                                                                                              // 98
                                                                                                                       // 99
  Alert.TRANSITION_DURATION = 150                                                                                      // 100
                                                                                                                       // 101
  Alert.prototype.close = function (e) {                                                                               // 102
    var $this    = $(this)                                                                                             // 103
    var selector = $this.attr('data-target')                                                                           // 104
                                                                                                                       // 105
    if (!selector) {                                                                                                   // 106
      selector = $this.attr('href')                                                                                    // 107
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7                                   // 108
    }                                                                                                                  // 109
                                                                                                                       // 110
    var $parent = $(selector)                                                                                          // 111
                                                                                                                       // 112
    if (e) e.preventDefault()                                                                                          // 113
                                                                                                                       // 114
    if (!$parent.length) {                                                                                             // 115
      $parent = $this.closest('.alert')                                                                                // 116
    }                                                                                                                  // 117
                                                                                                                       // 118
    $parent.trigger(e = $.Event('close.bs.alert'))                                                                     // 119
                                                                                                                       // 120
    if (e.isDefaultPrevented()) return                                                                                 // 121
                                                                                                                       // 122
    $parent.removeClass('in')                                                                                          // 123
                                                                                                                       // 124
    function removeElement() {                                                                                         // 125
      // detach from parent, fire event then clean up data                                                             // 126
      $parent.detach().trigger('closed.bs.alert').remove()                                                             // 127
    }                                                                                                                  // 128
                                                                                                                       // 129
    $.support.transition && $parent.hasClass('fade') ?                                                                 // 130
      $parent                                                                                                          // 131
        .one('bsTransitionEnd', removeElement)                                                                         // 132
        .emulateTransitionEnd(Alert.TRANSITION_DURATION) :                                                             // 133
      removeElement()                                                                                                  // 134
  }                                                                                                                    // 135
                                                                                                                       // 136
                                                                                                                       // 137
  // ALERT PLUGIN DEFINITION                                                                                           // 138
  // =======================                                                                                           // 139
                                                                                                                       // 140
  function Plugin(option) {                                                                                            // 141
    return this.each(function () {                                                                                     // 142
      var $this = $(this)                                                                                              // 143
      var data  = $this.data('bs.alert')                                                                               // 144
                                                                                                                       // 145
      if (!data) $this.data('bs.alert', (data = new Alert(this)))                                                      // 146
      if (typeof option == 'string') data[option].call($this)                                                          // 147
    })                                                                                                                 // 148
  }                                                                                                                    // 149
                                                                                                                       // 150
  var old = $.fn.alert                                                                                                 // 151
                                                                                                                       // 152
  $.fn.alert             = Plugin                                                                                      // 153
  $.fn.alert.Constructor = Alert                                                                                       // 154
                                                                                                                       // 155
                                                                                                                       // 156
  // ALERT NO CONFLICT                                                                                                 // 157
  // =================                                                                                                 // 158
                                                                                                                       // 159
  $.fn.alert.noConflict = function () {                                                                                // 160
    $.fn.alert = old                                                                                                   // 161
    return this                                                                                                        // 162
  }                                                                                                                    // 163
                                                                                                                       // 164
                                                                                                                       // 165
  // ALERT DATA-API                                                                                                    // 166
  // ==============                                                                                                    // 167
                                                                                                                       // 168
  $(document).on('click.bs.alert.data-api', dismiss, Alert.prototype.close)                                            // 169
                                                                                                                       // 170
}(jQuery);                                                                                                             // 171
                                                                                                                       // 172
/* ========================================================================                                            // 173
 * Bootstrap: button.js v3.3.1                                                                                         // 174
 * http://getbootstrap.com/javascript/#buttons                                                                         // 175
 * ========================================================================                                            // 176
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 177
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 178
 * ======================================================================== */                                         // 179
                                                                                                                       // 180
                                                                                                                       // 181
+function ($) {                                                                                                        // 182
  'use strict';                                                                                                        // 183
                                                                                                                       // 184
  // BUTTON PUBLIC CLASS DEFINITION                                                                                    // 185
  // ==============================                                                                                    // 186
                                                                                                                       // 187
  var Button = function (element, options) {                                                                           // 188
    this.$element  = $(element)                                                                                        // 189
    this.options   = $.extend({}, Button.DEFAULTS, options)                                                            // 190
    this.isLoading = false                                                                                             // 191
  }                                                                                                                    // 192
                                                                                                                       // 193
  Button.VERSION  = '3.3.1'                                                                                            // 194
                                                                                                                       // 195
  Button.DEFAULTS = {                                                                                                  // 196
    loadingText: 'loading...'                                                                                          // 197
  }                                                                                                                    // 198
                                                                                                                       // 199
  Button.prototype.setState = function (state) {                                                                       // 200
    var d    = 'disabled'                                                                                              // 201
    var $el  = this.$element                                                                                           // 202
    var val  = $el.is('input') ? 'val' : 'html'                                                                        // 203
    var data = $el.data()                                                                                              // 204
                                                                                                                       // 205
    state = state + 'Text'                                                                                             // 206
                                                                                                                       // 207
    if (data.resetText == null) $el.data('resetText', $el[val]())                                                      // 208
                                                                                                                       // 209
    // push to event loop to allow forms to submit                                                                     // 210
    setTimeout($.proxy(function () {                                                                                   // 211
      $el[val](data[state] == null ? this.options[state] : data[state])                                                // 212
                                                                                                                       // 213
      if (state == 'loadingText') {                                                                                    // 214
        this.isLoading = true                                                                                          // 215
        $el.addClass(d).attr(d, d)                                                                                     // 216
      } else if (this.isLoading) {                                                                                     // 217
        this.isLoading = false                                                                                         // 218
        $el.removeClass(d).removeAttr(d)                                                                               // 219
      }                                                                                                                // 220
    }, this), 0)                                                                                                       // 221
  }                                                                                                                    // 222
                                                                                                                       // 223
  Button.prototype.toggle = function () {                                                                              // 224
    var changed = true                                                                                                 // 225
    var $parent = this.$element.closest('[data-toggle="buttons"]')                                                     // 226
                                                                                                                       // 227
    if ($parent.length) {                                                                                              // 228
      var $input = this.$element.find('input')                                                                         // 229
      if ($input.prop('type') == 'radio') {                                                                            // 230
        if ($input.prop('checked') && this.$element.hasClass('active')) changed = false                                // 231
        else $parent.find('.active').removeClass('active')                                                             // 232
      }                                                                                                                // 233
      if (changed) $input.prop('checked', !this.$element.hasClass('active')).trigger('change')                         // 234
    } else {                                                                                                           // 235
      this.$element.attr('aria-pressed', !this.$element.hasClass('active'))                                            // 236
    }                                                                                                                  // 237
                                                                                                                       // 238
    if (changed) this.$element.toggleClass('active')                                                                   // 239
  }                                                                                                                    // 240
                                                                                                                       // 241
                                                                                                                       // 242
  // BUTTON PLUGIN DEFINITION                                                                                          // 243
  // ========================                                                                                          // 244
                                                                                                                       // 245
  function Plugin(option) {                                                                                            // 246
    return this.each(function () {                                                                                     // 247
      var $this   = $(this)                                                                                            // 248
      var data    = $this.data('bs.button')                                                                            // 249
      var options = typeof option == 'object' && option                                                                // 250
                                                                                                                       // 251
      if (!data) $this.data('bs.button', (data = new Button(this, options)))                                           // 252
                                                                                                                       // 253
      if (option == 'toggle') data.toggle()                                                                            // 254
      else if (option) data.setState(option)                                                                           // 255
    })                                                                                                                 // 256
  }                                                                                                                    // 257
                                                                                                                       // 258
  var old = $.fn.button                                                                                                // 259
                                                                                                                       // 260
  $.fn.button             = Plugin                                                                                     // 261
  $.fn.button.Constructor = Button                                                                                     // 262
                                                                                                                       // 263
                                                                                                                       // 264
  // BUTTON NO CONFLICT                                                                                                // 265
  // ==================                                                                                                // 266
                                                                                                                       // 267
  $.fn.button.noConflict = function () {                                                                               // 268
    $.fn.button = old                                                                                                  // 269
    return this                                                                                                        // 270
  }                                                                                                                    // 271
                                                                                                                       // 272
                                                                                                                       // 273
  // BUTTON DATA-API                                                                                                   // 274
  // ===============                                                                                                   // 275
                                                                                                                       // 276
  $(document)                                                                                                          // 277
    .on('click.bs.button.data-api', '[data-toggle^="button"]', function (e) {                                          // 278
      var $btn = $(e.target)                                                                                           // 279
      if (!$btn.hasClass('btn')) $btn = $btn.closest('.btn')                                                           // 280
      Plugin.call($btn, 'toggle')                                                                                      // 281
      e.preventDefault()                                                                                               // 282
    })                                                                                                                 // 283
    .on('focus.bs.button.data-api blur.bs.button.data-api', '[data-toggle^="button"]', function (e) {                  // 284
      $(e.target).closest('.btn').toggleClass('focus', /^focus(in)?$/.test(e.type))                                    // 285
    })                                                                                                                 // 286
                                                                                                                       // 287
}(jQuery);                                                                                                             // 288
                                                                                                                       // 289
/* ========================================================================                                            // 290
 * Bootstrap: carousel.js v3.3.1                                                                                       // 291
 * http://getbootstrap.com/javascript/#carousel                                                                        // 292
 * ========================================================================                                            // 293
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 294
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 295
 * ======================================================================== */                                         // 296
                                                                                                                       // 297
                                                                                                                       // 298
+function ($) {                                                                                                        // 299
  'use strict';                                                                                                        // 300
                                                                                                                       // 301
  // CAROUSEL CLASS DEFINITION                                                                                         // 302
  // =========================                                                                                         // 303
                                                                                                                       // 304
  var Carousel = function (element, options) {                                                                         // 305
    this.$element    = $(element)                                                                                      // 306
    this.$indicators = this.$element.find('.carousel-indicators')                                                      // 307
    this.options     = options                                                                                         // 308
    this.paused      =                                                                                                 // 309
    this.sliding     =                                                                                                 // 310
    this.interval    =                                                                                                 // 311
    this.$active     =                                                                                                 // 312
    this.$items      = null                                                                                            // 313
                                                                                                                       // 314
    this.options.keyboard && this.$element.on('keydown.bs.carousel', $.proxy(this.keydown, this))                      // 315
                                                                                                                       // 316
    this.options.pause == 'hover' && !('ontouchstart' in document.documentElement) && this.$element                    // 317
      .on('mouseenter.bs.carousel', $.proxy(this.pause, this))                                                         // 318
      .on('mouseleave.bs.carousel', $.proxy(this.cycle, this))                                                         // 319
  }                                                                                                                    // 320
                                                                                                                       // 321
  Carousel.VERSION  = '3.3.1'                                                                                          // 322
                                                                                                                       // 323
  Carousel.TRANSITION_DURATION = 600                                                                                   // 324
                                                                                                                       // 325
  Carousel.DEFAULTS = {                                                                                                // 326
    interval: 5000,                                                                                                    // 327
    pause: 'hover',                                                                                                    // 328
    wrap: true,                                                                                                        // 329
    keyboard: true                                                                                                     // 330
  }                                                                                                                    // 331
                                                                                                                       // 332
  Carousel.prototype.keydown = function (e) {                                                                          // 333
    if (/input|textarea/i.test(e.target.tagName)) return                                                               // 334
    switch (e.which) {                                                                                                 // 335
      case 37: this.prev(); break                                                                                      // 336
      case 39: this.next(); break                                                                                      // 337
      default: return                                                                                                  // 338
    }                                                                                                                  // 339
                                                                                                                       // 340
    e.preventDefault()                                                                                                 // 341
  }                                                                                                                    // 342
                                                                                                                       // 343
  Carousel.prototype.cycle = function (e) {                                                                            // 344
    e || (this.paused = false)                                                                                         // 345
                                                                                                                       // 346
    this.interval && clearInterval(this.interval)                                                                      // 347
                                                                                                                       // 348
    this.options.interval                                                                                              // 349
      && !this.paused                                                                                                  // 350
      && (this.interval = setInterval($.proxy(this.next, this), this.options.interval))                                // 351
                                                                                                                       // 352
    return this                                                                                                        // 353
  }                                                                                                                    // 354
                                                                                                                       // 355
  Carousel.prototype.getItemIndex = function (item) {                                                                  // 356
    this.$items = item.parent().children('.item')                                                                      // 357
    return this.$items.index(item || this.$active)                                                                     // 358
  }                                                                                                                    // 359
                                                                                                                       // 360
  Carousel.prototype.getItemForDirection = function (direction, active) {                                              // 361
    var delta = direction == 'prev' ? -1 : 1                                                                           // 362
    var activeIndex = this.getItemIndex(active)                                                                        // 363
    var itemIndex = (activeIndex + delta) % this.$items.length                                                         // 364
    return this.$items.eq(itemIndex)                                                                                   // 365
  }                                                                                                                    // 366
                                                                                                                       // 367
  Carousel.prototype.to = function (pos) {                                                                             // 368
    var that        = this                                                                                             // 369
    var activeIndex = this.getItemIndex(this.$active = this.$element.find('.item.active'))                             // 370
                                                                                                                       // 371
    if (pos > (this.$items.length - 1) || pos < 0) return                                                              // 372
                                                                                                                       // 373
    if (this.sliding)       return this.$element.one('slid.bs.carousel', function () { that.to(pos) }) // yes, "slid"  // 374
    if (activeIndex == pos) return this.pause().cycle()                                                                // 375
                                                                                                                       // 376
    return this.slide(pos > activeIndex ? 'next' : 'prev', this.$items.eq(pos))                                        // 377
  }                                                                                                                    // 378
                                                                                                                       // 379
  Carousel.prototype.pause = function (e) {                                                                            // 380
    e || (this.paused = true)                                                                                          // 381
                                                                                                                       // 382
    if (this.$element.find('.next, .prev').length && $.support.transition) {                                           // 383
      this.$element.trigger($.support.transition.end)                                                                  // 384
      this.cycle(true)                                                                                                 // 385
    }                                                                                                                  // 386
                                                                                                                       // 387
    this.interval = clearInterval(this.interval)                                                                       // 388
                                                                                                                       // 389
    return this                                                                                                        // 390
  }                                                                                                                    // 391
                                                                                                                       // 392
  Carousel.prototype.next = function () {                                                                              // 393
    if (this.sliding) return                                                                                           // 394
    return this.slide('next')                                                                                          // 395
  }                                                                                                                    // 396
                                                                                                                       // 397
  Carousel.prototype.prev = function () {                                                                              // 398
    if (this.sliding) return                                                                                           // 399
    return this.slide('prev')                                                                                          // 400
  }                                                                                                                    // 401
                                                                                                                       // 402
  Carousel.prototype.slide = function (type, next) {                                                                   // 403
    var $active   = this.$element.find('.item.active')                                                                 // 404
    var $next     = next || this.getItemForDirection(type, $active)                                                    // 405
    var isCycling = this.interval                                                                                      // 406
    var direction = type == 'next' ? 'left' : 'right'                                                                  // 407
    var fallback  = type == 'next' ? 'first' : 'last'                                                                  // 408
    var that      = this                                                                                               // 409
                                                                                                                       // 410
    if (!$next.length) {                                                                                               // 411
      if (!this.options.wrap) return                                                                                   // 412
      $next = this.$element.find('.item')[fallback]()                                                                  // 413
    }                                                                                                                  // 414
                                                                                                                       // 415
    if ($next.hasClass('active')) return (this.sliding = false)                                                        // 416
                                                                                                                       // 417
    var relatedTarget = $next[0]                                                                                       // 418
    var slideEvent = $.Event('slide.bs.carousel', {                                                                    // 419
      relatedTarget: relatedTarget,                                                                                    // 420
      direction: direction                                                                                             // 421
    })                                                                                                                 // 422
    this.$element.trigger(slideEvent)                                                                                  // 423
    if (slideEvent.isDefaultPrevented()) return                                                                        // 424
                                                                                                                       // 425
    this.sliding = true                                                                                                // 426
                                                                                                                       // 427
    isCycling && this.pause()                                                                                          // 428
                                                                                                                       // 429
    if (this.$indicators.length) {                                                                                     // 430
      this.$indicators.find('.active').removeClass('active')                                                           // 431
      var $nextIndicator = $(this.$indicators.children()[this.getItemIndex($next)])                                    // 432
      $nextIndicator && $nextIndicator.addClass('active')                                                              // 433
    }                                                                                                                  // 434
                                                                                                                       // 435
    var slidEvent = $.Event('slid.bs.carousel', { relatedTarget: relatedTarget, direction: direction }) // yes, "slid" // 436
    if ($.support.transition && this.$element.hasClass('slide')) {                                                     // 437
      $next.addClass(type)                                                                                             // 438
      $next[0].offsetWidth // force reflow                                                                             // 439
      $active.addClass(direction)                                                                                      // 440
      $next.addClass(direction)                                                                                        // 441
      $active                                                                                                          // 442
        .one('bsTransitionEnd', function () {                                                                          // 443
          $next.removeClass([type, direction].join(' ')).addClass('active')                                            // 444
          $active.removeClass(['active', direction].join(' '))                                                         // 445
          that.sliding = false                                                                                         // 446
          setTimeout(function () {                                                                                     // 447
            that.$element.trigger(slidEvent)                                                                           // 448
          }, 0)                                                                                                        // 449
        })                                                                                                             // 450
        .emulateTransitionEnd(Carousel.TRANSITION_DURATION)                                                            // 451
    } else {                                                                                                           // 452
      $active.removeClass('active')                                                                                    // 453
      $next.addClass('active')                                                                                         // 454
      this.sliding = false                                                                                             // 455
      this.$element.trigger(slidEvent)                                                                                 // 456
    }                                                                                                                  // 457
                                                                                                                       // 458
    isCycling && this.cycle()                                                                                          // 459
                                                                                                                       // 460
    return this                                                                                                        // 461
  }                                                                                                                    // 462
                                                                                                                       // 463
                                                                                                                       // 464
  // CAROUSEL PLUGIN DEFINITION                                                                                        // 465
  // ==========================                                                                                        // 466
                                                                                                                       // 467
  function Plugin(option) {                                                                                            // 468
    return this.each(function () {                                                                                     // 469
      var $this   = $(this)                                                                                            // 470
      var data    = $this.data('bs.carousel')                                                                          // 471
      var options = $.extend({}, Carousel.DEFAULTS, $this.data(), typeof option == 'object' && option)                 // 472
      var action  = typeof option == 'string' ? option : options.slide                                                 // 473
                                                                                                                       // 474
      if (!data) $this.data('bs.carousel', (data = new Carousel(this, options)))                                       // 475
      if (typeof option == 'number') data.to(option)                                                                   // 476
      else if (action) data[action]()                                                                                  // 477
      else if (options.interval) data.pause().cycle()                                                                  // 478
    })                                                                                                                 // 479
  }                                                                                                                    // 480
                                                                                                                       // 481
  var old = $.fn.carousel                                                                                              // 482
                                                                                                                       // 483
  $.fn.carousel             = Plugin                                                                                   // 484
  $.fn.carousel.Constructor = Carousel                                                                                 // 485
                                                                                                                       // 486
                                                                                                                       // 487
  // CAROUSEL NO CONFLICT                                                                                              // 488
  // ====================                                                                                              // 489
                                                                                                                       // 490
  $.fn.carousel.noConflict = function () {                                                                             // 491
    $.fn.carousel = old                                                                                                // 492
    return this                                                                                                        // 493
  }                                                                                                                    // 494
                                                                                                                       // 495
                                                                                                                       // 496
  // CAROUSEL DATA-API                                                                                                 // 497
  // =================                                                                                                 // 498
                                                                                                                       // 499
  var clickHandler = function (e) {                                                                                    // 500
    var href                                                                                                           // 501
    var $this   = $(this)                                                                                              // 502
    var $target = $($this.attr('data-target') || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) // strip for ie7
    if (!$target.hasClass('carousel')) return                                                                          // 504
    var options = $.extend({}, $target.data(), $this.data())                                                           // 505
    var slideIndex = $this.attr('data-slide-to')                                                                       // 506
    if (slideIndex) options.interval = false                                                                           // 507
                                                                                                                       // 508
    Plugin.call($target, options)                                                                                      // 509
                                                                                                                       // 510
    if (slideIndex) {                                                                                                  // 511
      $target.data('bs.carousel').to(slideIndex)                                                                       // 512
    }                                                                                                                  // 513
                                                                                                                       // 514
    e.preventDefault()                                                                                                 // 515
  }                                                                                                                    // 516
                                                                                                                       // 517
  $(document)                                                                                                          // 518
    .on('click.bs.carousel.data-api', '[data-slide]', clickHandler)                                                    // 519
    .on('click.bs.carousel.data-api', '[data-slide-to]', clickHandler)                                                 // 520
                                                                                                                       // 521
  $(window).on('load', function () {                                                                                   // 522
    $('[data-ride="carousel"]').each(function () {                                                                     // 523
      var $carousel = $(this)                                                                                          // 524
      Plugin.call($carousel, $carousel.data())                                                                         // 525
    })                                                                                                                 // 526
  })                                                                                                                   // 527
                                                                                                                       // 528
}(jQuery);                                                                                                             // 529
                                                                                                                       // 530
/* ========================================================================                                            // 531
 * Bootstrap: collapse.js v3.3.1                                                                                       // 532
 * http://getbootstrap.com/javascript/#collapse                                                                        // 533
 * ========================================================================                                            // 534
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 535
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 536
 * ======================================================================== */                                         // 537
                                                                                                                       // 538
                                                                                                                       // 539
+function ($) {                                                                                                        // 540
  'use strict';                                                                                                        // 541
                                                                                                                       // 542
  // COLLAPSE PUBLIC CLASS DEFINITION                                                                                  // 543
  // ================================                                                                                  // 544
                                                                                                                       // 545
  var Collapse = function (element, options) {                                                                         // 546
    this.$element      = $(element)                                                                                    // 547
    this.options       = $.extend({}, Collapse.DEFAULTS, options)                                                      // 548
    this.$trigger      = $(this.options.trigger).filter('[href="#' + element.id + '"], [data-target="#' + element.id + '"]')
    this.transitioning = null                                                                                          // 550
                                                                                                                       // 551
    if (this.options.parent) {                                                                                         // 552
      this.$parent = this.getParent()                                                                                  // 553
    } else {                                                                                                           // 554
      this.addAriaAndCollapsedClass(this.$element, this.$trigger)                                                      // 555
    }                                                                                                                  // 556
                                                                                                                       // 557
    if (this.options.toggle) this.toggle()                                                                             // 558
  }                                                                                                                    // 559
                                                                                                                       // 560
  Collapse.VERSION  = '3.3.1'                                                                                          // 561
                                                                                                                       // 562
  Collapse.TRANSITION_DURATION = 350                                                                                   // 563
                                                                                                                       // 564
  Collapse.DEFAULTS = {                                                                                                // 565
    toggle: true,                                                                                                      // 566
    trigger: '[data-toggle="collapse"]'                                                                                // 567
  }                                                                                                                    // 568
                                                                                                                       // 569
  Collapse.prototype.dimension = function () {                                                                         // 570
    var hasWidth = this.$element.hasClass('width')                                                                     // 571
    return hasWidth ? 'width' : 'height'                                                                               // 572
  }                                                                                                                    // 573
                                                                                                                       // 574
  Collapse.prototype.show = function () {                                                                              // 575
    if (this.transitioning || this.$element.hasClass('in')) return                                                     // 576
                                                                                                                       // 577
    var activesData                                                                                                    // 578
    var actives = this.$parent && this.$parent.find('> .panel').children('.in, .collapsing')                           // 579
                                                                                                                       // 580
    if (actives && actives.length) {                                                                                   // 581
      activesData = actives.data('bs.collapse')                                                                        // 582
      if (activesData && activesData.transitioning) return                                                             // 583
    }                                                                                                                  // 584
                                                                                                                       // 585
    var startEvent = $.Event('show.bs.collapse')                                                                       // 586
    this.$element.trigger(startEvent)                                                                                  // 587
    if (startEvent.isDefaultPrevented()) return                                                                        // 588
                                                                                                                       // 589
    if (actives && actives.length) {                                                                                   // 590
      Plugin.call(actives, 'hide')                                                                                     // 591
      activesData || actives.data('bs.collapse', null)                                                                 // 592
    }                                                                                                                  // 593
                                                                                                                       // 594
    var dimension = this.dimension()                                                                                   // 595
                                                                                                                       // 596
    this.$element                                                                                                      // 597
      .removeClass('collapse')                                                                                         // 598
      .addClass('collapsing')[dimension](0)                                                                            // 599
      .attr('aria-expanded', true)                                                                                     // 600
                                                                                                                       // 601
    this.$trigger                                                                                                      // 602
      .removeClass('collapsed')                                                                                        // 603
      .attr('aria-expanded', true)                                                                                     // 604
                                                                                                                       // 605
    this.transitioning = 1                                                                                             // 606
                                                                                                                       // 607
    var complete = function () {                                                                                       // 608
      this.$element                                                                                                    // 609
        .removeClass('collapsing')                                                                                     // 610
        .addClass('collapse in')[dimension]('')                                                                        // 611
      this.transitioning = 0                                                                                           // 612
      this.$element                                                                                                    // 613
        .trigger('shown.bs.collapse')                                                                                  // 614
    }                                                                                                                  // 615
                                                                                                                       // 616
    if (!$.support.transition) return complete.call(this)                                                              // 617
                                                                                                                       // 618
    var scrollSize = $.camelCase(['scroll', dimension].join('-'))                                                      // 619
                                                                                                                       // 620
    this.$element                                                                                                      // 621
      .one('bsTransitionEnd', $.proxy(complete, this))                                                                 // 622
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)[dimension](this.$element[0][scrollSize])                     // 623
  }                                                                                                                    // 624
                                                                                                                       // 625
  Collapse.prototype.hide = function () {                                                                              // 626
    if (this.transitioning || !this.$element.hasClass('in')) return                                                    // 627
                                                                                                                       // 628
    var startEvent = $.Event('hide.bs.collapse')                                                                       // 629
    this.$element.trigger(startEvent)                                                                                  // 630
    if (startEvent.isDefaultPrevented()) return                                                                        // 631
                                                                                                                       // 632
    var dimension = this.dimension()                                                                                   // 633
                                                                                                                       // 634
    this.$element[dimension](this.$element[dimension]())[0].offsetHeight                                               // 635
                                                                                                                       // 636
    this.$element                                                                                                      // 637
      .addClass('collapsing')                                                                                          // 638
      .removeClass('collapse in')                                                                                      // 639
      .attr('aria-expanded', false)                                                                                    // 640
                                                                                                                       // 641
    this.$trigger                                                                                                      // 642
      .addClass('collapsed')                                                                                           // 643
      .attr('aria-expanded', false)                                                                                    // 644
                                                                                                                       // 645
    this.transitioning = 1                                                                                             // 646
                                                                                                                       // 647
    var complete = function () {                                                                                       // 648
      this.transitioning = 0                                                                                           // 649
      this.$element                                                                                                    // 650
        .removeClass('collapsing')                                                                                     // 651
        .addClass('collapse')                                                                                          // 652
        .trigger('hidden.bs.collapse')                                                                                 // 653
    }                                                                                                                  // 654
                                                                                                                       // 655
    if (!$.support.transition) return complete.call(this)                                                              // 656
                                                                                                                       // 657
    this.$element                                                                                                      // 658
      [dimension](0)                                                                                                   // 659
      .one('bsTransitionEnd', $.proxy(complete, this))                                                                 // 660
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)                                                              // 661
  }                                                                                                                    // 662
                                                                                                                       // 663
  Collapse.prototype.toggle = function () {                                                                            // 664
    this[this.$element.hasClass('in') ? 'hide' : 'show']()                                                             // 665
  }                                                                                                                    // 666
                                                                                                                       // 667
  Collapse.prototype.getParent = function () {                                                                         // 668
    return $(this.options.parent)                                                                                      // 669
      .find('[data-toggle="collapse"][data-parent="' + this.options.parent + '"]')                                     // 670
      .each($.proxy(function (i, element) {                                                                            // 671
        var $element = $(element)                                                                                      // 672
        this.addAriaAndCollapsedClass(getTargetFromTrigger($element), $element)                                        // 673
      }, this))                                                                                                        // 674
      .end()                                                                                                           // 675
  }                                                                                                                    // 676
                                                                                                                       // 677
  Collapse.prototype.addAriaAndCollapsedClass = function ($element, $trigger) {                                        // 678
    var isOpen = $element.hasClass('in')                                                                               // 679
                                                                                                                       // 680
    $element.attr('aria-expanded', isOpen)                                                                             // 681
    $trigger                                                                                                           // 682
      .toggleClass('collapsed', !isOpen)                                                                               // 683
      .attr('aria-expanded', isOpen)                                                                                   // 684
  }                                                                                                                    // 685
                                                                                                                       // 686
  function getTargetFromTrigger($trigger) {                                                                            // 687
    var href                                                                                                           // 688
    var target = $trigger.attr('data-target')                                                                          // 689
      || (href = $trigger.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') // strip for ie7                         // 690
                                                                                                                       // 691
    return $(target)                                                                                                   // 692
  }                                                                                                                    // 693
                                                                                                                       // 694
                                                                                                                       // 695
  // COLLAPSE PLUGIN DEFINITION                                                                                        // 696
  // ==========================                                                                                        // 697
                                                                                                                       // 698
  function Plugin(option) {                                                                                            // 699
    return this.each(function () {                                                                                     // 700
      var $this   = $(this)                                                                                            // 701
      var data    = $this.data('bs.collapse')                                                                          // 702
      var options = $.extend({}, Collapse.DEFAULTS, $this.data(), typeof option == 'object' && option)                 // 703
                                                                                                                       // 704
      if (!data && options.toggle && option == 'show') options.toggle = false                                          // 705
      if (!data) $this.data('bs.collapse', (data = new Collapse(this, options)))                                       // 706
      if (typeof option == 'string') data[option]()                                                                    // 707
    })                                                                                                                 // 708
  }                                                                                                                    // 709
                                                                                                                       // 710
  var old = $.fn.collapse                                                                                              // 711
                                                                                                                       // 712
  $.fn.collapse             = Plugin                                                                                   // 713
  $.fn.collapse.Constructor = Collapse                                                                                 // 714
                                                                                                                       // 715
                                                                                                                       // 716
  // COLLAPSE NO CONFLICT                                                                                              // 717
  // ====================                                                                                              // 718
                                                                                                                       // 719
  $.fn.collapse.noConflict = function () {                                                                             // 720
    $.fn.collapse = old                                                                                                // 721
    return this                                                                                                        // 722
  }                                                                                                                    // 723
                                                                                                                       // 724
                                                                                                                       // 725
  // COLLAPSE DATA-API                                                                                                 // 726
  // =================                                                                                                 // 727
                                                                                                                       // 728
  $(document).on('click.bs.collapse.data-api', '[data-toggle="collapse"]', function (e) {                              // 729
    var $this   = $(this)                                                                                              // 730
                                                                                                                       // 731
    if (!$this.attr('data-target')) e.preventDefault()                                                                 // 732
                                                                                                                       // 733
    var $target = getTargetFromTrigger($this)                                                                          // 734
    var data    = $target.data('bs.collapse')                                                                          // 735
    var option  = data ? 'toggle' : $.extend({}, $this.data(), { trigger: this })                                      // 736
                                                                                                                       // 737
    Plugin.call($target, option)                                                                                       // 738
  })                                                                                                                   // 739
                                                                                                                       // 740
}(jQuery);                                                                                                             // 741
                                                                                                                       // 742
/* ========================================================================                                            // 743
 * Bootstrap: dropdown.js v3.3.1                                                                                       // 744
 * http://getbootstrap.com/javascript/#dropdowns                                                                       // 745
 * ========================================================================                                            // 746
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 747
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 748
 * ======================================================================== */                                         // 749
                                                                                                                       // 750
                                                                                                                       // 751
+function ($) {                                                                                                        // 752
  'use strict';                                                                                                        // 753
                                                                                                                       // 754
  // DROPDOWN CLASS DEFINITION                                                                                         // 755
  // =========================                                                                                         // 756
                                                                                                                       // 757
  var backdrop = '.dropdown-backdrop'                                                                                  // 758
  var toggle   = '[data-toggle="dropdown"]'                                                                            // 759
  var Dropdown = function (element) {                                                                                  // 760
    $(element).on('click.bs.dropdown', this.toggle)                                                                    // 761
  }                                                                                                                    // 762
                                                                                                                       // 763
  Dropdown.VERSION = '3.3.1'                                                                                           // 764
                                                                                                                       // 765
  Dropdown.prototype.toggle = function (e) {                                                                           // 766
    var $this = $(this)                                                                                                // 767
                                                                                                                       // 768
    if ($this.is('.disabled, :disabled')) return                                                                       // 769
                                                                                                                       // 770
    var $parent  = getParent($this)                                                                                    // 771
    var isActive = $parent.hasClass('open')                                                                            // 772
                                                                                                                       // 773
    clearMenus()                                                                                                       // 774
                                                                                                                       // 775
    if (!isActive) {                                                                                                   // 776
      if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {                      // 777
        // if mobile we use a backdrop because click events don't delegate                                             // 778
        $('<div class="dropdown-backdrop"/>').insertAfter($(this)).on('click', clearMenus)                             // 779
      }                                                                                                                // 780
                                                                                                                       // 781
      var relatedTarget = { relatedTarget: this }                                                                      // 782
      $parent.trigger(e = $.Event('show.bs.dropdown', relatedTarget))                                                  // 783
                                                                                                                       // 784
      if (e.isDefaultPrevented()) return                                                                               // 785
                                                                                                                       // 786
      $this                                                                                                            // 787
        .trigger('focus')                                                                                              // 788
        .attr('aria-expanded', 'true')                                                                                 // 789
                                                                                                                       // 790
      $parent                                                                                                          // 791
        .toggleClass('open')                                                                                           // 792
        .trigger('shown.bs.dropdown', relatedTarget)                                                                   // 793
    }                                                                                                                  // 794
                                                                                                                       // 795
    return false                                                                                                       // 796
  }                                                                                                                    // 797
                                                                                                                       // 798
  Dropdown.prototype.keydown = function (e) {                                                                          // 799
    if (!/(38|40|27|32)/.test(e.which) || /input|textarea/i.test(e.target.tagName)) return                             // 800
                                                                                                                       // 801
    var $this = $(this)                                                                                                // 802
                                                                                                                       // 803
    e.preventDefault()                                                                                                 // 804
    e.stopPropagation()                                                                                                // 805
                                                                                                                       // 806
    if ($this.is('.disabled, :disabled')) return                                                                       // 807
                                                                                                                       // 808
    var $parent  = getParent($this)                                                                                    // 809
    var isActive = $parent.hasClass('open')                                                                            // 810
                                                                                                                       // 811
    if ((!isActive && e.which != 27) || (isActive && e.which == 27)) {                                                 // 812
      if (e.which == 27) $parent.find(toggle).trigger('focus')                                                         // 813
      return $this.trigger('click')                                                                                    // 814
    }                                                                                                                  // 815
                                                                                                                       // 816
    var desc = ' li:not(.divider):visible a'                                                                           // 817
    var $items = $parent.find('[role="menu"]' + desc + ', [role="listbox"]' + desc)                                    // 818
                                                                                                                       // 819
    if (!$items.length) return                                                                                         // 820
                                                                                                                       // 821
    var index = $items.index(e.target)                                                                                 // 822
                                                                                                                       // 823
    if (e.which == 38 && index > 0)                 index--                        // up                               // 824
    if (e.which == 40 && index < $items.length - 1) index++                        // down                             // 825
    if (!~index)                                      index = 0                                                        // 826
                                                                                                                       // 827
    $items.eq(index).trigger('focus')                                                                                  // 828
  }                                                                                                                    // 829
                                                                                                                       // 830
  function clearMenus(e) {                                                                                             // 831
    if (e && e.which === 3) return                                                                                     // 832
    $(backdrop).remove()                                                                                               // 833
    $(toggle).each(function () {                                                                                       // 834
      var $this         = $(this)                                                                                      // 835
      var $parent       = getParent($this)                                                                             // 836
      var relatedTarget = { relatedTarget: this }                                                                      // 837
                                                                                                                       // 838
      if (!$parent.hasClass('open')) return                                                                            // 839
                                                                                                                       // 840
      $parent.trigger(e = $.Event('hide.bs.dropdown', relatedTarget))                                                  // 841
                                                                                                                       // 842
      if (e.isDefaultPrevented()) return                                                                               // 843
                                                                                                                       // 844
      $this.attr('aria-expanded', 'false')                                                                             // 845
      $parent.removeClass('open').trigger('hidden.bs.dropdown', relatedTarget)                                         // 846
    })                                                                                                                 // 847
  }                                                                                                                    // 848
                                                                                                                       // 849
  function getParent($this) {                                                                                          // 850
    var selector = $this.attr('data-target')                                                                           // 851
                                                                                                                       // 852
    if (!selector) {                                                                                                   // 853
      selector = $this.attr('href')                                                                                    // 854
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7     // 855
    }                                                                                                                  // 856
                                                                                                                       // 857
    var $parent = selector && $(selector)                                                                              // 858
                                                                                                                       // 859
    return $parent && $parent.length ? $parent : $this.parent()                                                        // 860
  }                                                                                                                    // 861
                                                                                                                       // 862
                                                                                                                       // 863
  // DROPDOWN PLUGIN DEFINITION                                                                                        // 864
  // ==========================                                                                                        // 865
                                                                                                                       // 866
  function Plugin(option) {                                                                                            // 867
    return this.each(function () {                                                                                     // 868
      var $this = $(this)                                                                                              // 869
      var data  = $this.data('bs.dropdown')                                                                            // 870
                                                                                                                       // 871
      if (!data) $this.data('bs.dropdown', (data = new Dropdown(this)))                                                // 872
      if (typeof option == 'string') data[option].call($this)                                                          // 873
    })                                                                                                                 // 874
  }                                                                                                                    // 875
                                                                                                                       // 876
  var old = $.fn.dropdown                                                                                              // 877
                                                                                                                       // 878
  $.fn.dropdown             = Plugin                                                                                   // 879
  $.fn.dropdown.Constructor = Dropdown                                                                                 // 880
                                                                                                                       // 881
                                                                                                                       // 882
  // DROPDOWN NO CONFLICT                                                                                              // 883
  // ====================                                                                                              // 884
                                                                                                                       // 885
  $.fn.dropdown.noConflict = function () {                                                                             // 886
    $.fn.dropdown = old                                                                                                // 887
    return this                                                                                                        // 888
  }                                                                                                                    // 889
                                                                                                                       // 890
                                                                                                                       // 891
  // APPLY TO STANDARD DROPDOWN ELEMENTS                                                                               // 892
  // ===================================                                                                               // 893
                                                                                                                       // 894
  $(document)                                                                                                          // 895
    .on('click.bs.dropdown.data-api', clearMenus)                                                                      // 896
    .on('click.bs.dropdown.data-api', '.dropdown form', function (e) { e.stopPropagation() })                          // 897
    .on('click.bs.dropdown.data-api', toggle, Dropdown.prototype.toggle)                                               // 898
    .on('keydown.bs.dropdown.data-api', toggle, Dropdown.prototype.keydown)                                            // 899
    .on('keydown.bs.dropdown.data-api', '[role="menu"]', Dropdown.prototype.keydown)                                   // 900
    .on('keydown.bs.dropdown.data-api', '[role="listbox"]', Dropdown.prototype.keydown)                                // 901
                                                                                                                       // 902
}(jQuery);                                                                                                             // 903
                                                                                                                       // 904
/* ========================================================================                                            // 905
 * Bootstrap: modal.js v3.3.1                                                                                          // 906
 * http://getbootstrap.com/javascript/#modals                                                                          // 907
 * ========================================================================                                            // 908
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 909
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 910
 * ======================================================================== */                                         // 911
                                                                                                                       // 912
                                                                                                                       // 913
+function ($) {                                                                                                        // 914
  'use strict';                                                                                                        // 915
                                                                                                                       // 916
  // MODAL CLASS DEFINITION                                                                                            // 917
  // ======================                                                                                            // 918
                                                                                                                       // 919
  var Modal = function (element, options) {                                                                            // 920
    this.options        = options                                                                                      // 921
    this.$body          = $(document.body)                                                                             // 922
    this.$element       = $(element)                                                                                   // 923
    this.$backdrop      =                                                                                              // 924
    this.isShown        = null                                                                                         // 925
    this.scrollbarWidth = 0                                                                                            // 926
                                                                                                                       // 927
    if (this.options.remote) {                                                                                         // 928
      this.$element                                                                                                    // 929
        .find('.modal-content')                                                                                        // 930
        .load(this.options.remote, $.proxy(function () {                                                               // 931
          this.$element.trigger('loaded.bs.modal')                                                                     // 932
        }, this))                                                                                                      // 933
    }                                                                                                                  // 934
  }                                                                                                                    // 935
                                                                                                                       // 936
  Modal.VERSION  = '3.3.1'                                                                                             // 937
                                                                                                                       // 938
  Modal.TRANSITION_DURATION = 300                                                                                      // 939
  Modal.BACKDROP_TRANSITION_DURATION = 150                                                                             // 940
                                                                                                                       // 941
  Modal.DEFAULTS = {                                                                                                   // 942
    backdrop: true,                                                                                                    // 943
    keyboard: true,                                                                                                    // 944
    show: true                                                                                                         // 945
  }                                                                                                                    // 946
                                                                                                                       // 947
  Modal.prototype.toggle = function (_relatedTarget) {                                                                 // 948
    return this.isShown ? this.hide() : this.show(_relatedTarget)                                                      // 949
  }                                                                                                                    // 950
                                                                                                                       // 951
  Modal.prototype.show = function (_relatedTarget) {                                                                   // 952
    var that = this                                                                                                    // 953
    var e    = $.Event('show.bs.modal', { relatedTarget: _relatedTarget })                                             // 954
                                                                                                                       // 955
    this.$element.trigger(e)                                                                                           // 956
                                                                                                                       // 957
    if (this.isShown || e.isDefaultPrevented()) return                                                                 // 958
                                                                                                                       // 959
    this.isShown = true                                                                                                // 960
                                                                                                                       // 961
    this.checkScrollbar()                                                                                              // 962
    this.setScrollbar()                                                                                                // 963
    this.$body.addClass('modal-open')                                                                                  // 964
                                                                                                                       // 965
    this.escape()                                                                                                      // 966
    this.resize()                                                                                                      // 967
                                                                                                                       // 968
    this.$element.on('click.dismiss.bs.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this))                     // 969
                                                                                                                       // 970
    this.backdrop(function () {                                                                                        // 971
      var transition = $.support.transition && that.$element.hasClass('fade')                                          // 972
                                                                                                                       // 973
      if (!that.$element.parent().length) {                                                                            // 974
        that.$element.appendTo(that.$body) // don't move modals dom position                                           // 975
      }                                                                                                                // 976
                                                                                                                       // 977
      that.$element                                                                                                    // 978
        .show()                                                                                                        // 979
        .scrollTop(0)                                                                                                  // 980
                                                                                                                       // 981
      if (that.options.backdrop) that.adjustBackdrop()                                                                 // 982
      that.adjustDialog()                                                                                              // 983
                                                                                                                       // 984
      if (transition) {                                                                                                // 985
        that.$element[0].offsetWidth // force reflow                                                                   // 986
      }                                                                                                                // 987
                                                                                                                       // 988
      that.$element                                                                                                    // 989
        .addClass('in')                                                                                                // 990
        .attr('aria-hidden', false)                                                                                    // 991
                                                                                                                       // 992
      that.enforceFocus()                                                                                              // 993
                                                                                                                       // 994
      var e = $.Event('shown.bs.modal', { relatedTarget: _relatedTarget })                                             // 995
                                                                                                                       // 996
      transition ?                                                                                                     // 997
        that.$element.find('.modal-dialog') // wait for modal to slide in                                              // 998
          .one('bsTransitionEnd', function () {                                                                        // 999
            that.$element.trigger('focus').trigger(e)                                                                  // 1000
          })                                                                                                           // 1001
          .emulateTransitionEnd(Modal.TRANSITION_DURATION) :                                                           // 1002
        that.$element.trigger('focus').trigger(e)                                                                      // 1003
    })                                                                                                                 // 1004
  }                                                                                                                    // 1005
                                                                                                                       // 1006
  Modal.prototype.hide = function (e) {                                                                                // 1007
    if (e) e.preventDefault()                                                                                          // 1008
                                                                                                                       // 1009
    e = $.Event('hide.bs.modal')                                                                                       // 1010
                                                                                                                       // 1011
    this.$element.trigger(e)                                                                                           // 1012
                                                                                                                       // 1013
    if (!this.isShown || e.isDefaultPrevented()) return                                                                // 1014
                                                                                                                       // 1015
    this.isShown = false                                                                                               // 1016
                                                                                                                       // 1017
    this.escape()                                                                                                      // 1018
    this.resize()                                                                                                      // 1019
                                                                                                                       // 1020
    $(document).off('focusin.bs.modal')                                                                                // 1021
                                                                                                                       // 1022
    this.$element                                                                                                      // 1023
      .removeClass('in')                                                                                               // 1024
      .attr('aria-hidden', true)                                                                                       // 1025
      .off('click.dismiss.bs.modal')                                                                                   // 1026
                                                                                                                       // 1027
    $.support.transition && this.$element.hasClass('fade') ?                                                           // 1028
      this.$element                                                                                                    // 1029
        .one('bsTransitionEnd', $.proxy(this.hideModal, this))                                                         // 1030
        .emulateTransitionEnd(Modal.TRANSITION_DURATION) :                                                             // 1031
      this.hideModal()                                                                                                 // 1032
  }                                                                                                                    // 1033
                                                                                                                       // 1034
  Modal.prototype.enforceFocus = function () {                                                                         // 1035
    $(document)                                                                                                        // 1036
      .off('focusin.bs.modal') // guard against infinite focus loop                                                    // 1037
      .on('focusin.bs.modal', $.proxy(function (e) {                                                                   // 1038
        if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {                                    // 1039
          this.$element.trigger('focus')                                                                               // 1040
        }                                                                                                              // 1041
      }, this))                                                                                                        // 1042
  }                                                                                                                    // 1043
                                                                                                                       // 1044
  Modal.prototype.escape = function () {                                                                               // 1045
    if (this.isShown && this.options.keyboard) {                                                                       // 1046
      this.$element.on('keydown.dismiss.bs.modal', $.proxy(function (e) {                                              // 1047
        e.which == 27 && this.hide()                                                                                   // 1048
      }, this))                                                                                                        // 1049
    } else if (!this.isShown) {                                                                                        // 1050
      this.$element.off('keydown.dismiss.bs.modal')                                                                    // 1051
    }                                                                                                                  // 1052
  }                                                                                                                    // 1053
                                                                                                                       // 1054
  Modal.prototype.resize = function () {                                                                               // 1055
    if (this.isShown) {                                                                                                // 1056
      $(window).on('resize.bs.modal', $.proxy(this.handleUpdate, this))                                                // 1057
    } else {                                                                                                           // 1058
      $(window).off('resize.bs.modal')                                                                                 // 1059
    }                                                                                                                  // 1060
  }                                                                                                                    // 1061
                                                                                                                       // 1062
  Modal.prototype.hideModal = function () {                                                                            // 1063
    var that = this                                                                                                    // 1064
    this.$element.hide()                                                                                               // 1065
    this.backdrop(function () {                                                                                        // 1066
      that.$body.removeClass('modal-open')                                                                             // 1067
      that.resetAdjustments()                                                                                          // 1068
      that.resetScrollbar()                                                                                            // 1069
      that.$element.trigger('hidden.bs.modal')                                                                         // 1070
    })                                                                                                                 // 1071
  }                                                                                                                    // 1072
                                                                                                                       // 1073
  Modal.prototype.removeBackdrop = function () {                                                                       // 1074
    this.$backdrop && this.$backdrop.remove()                                                                          // 1075
    this.$backdrop = null                                                                                              // 1076
  }                                                                                                                    // 1077
                                                                                                                       // 1078
  Modal.prototype.backdrop = function (callback) {                                                                     // 1079
    var that = this                                                                                                    // 1080
    var animate = this.$element.hasClass('fade') ? 'fade' : ''                                                         // 1081
                                                                                                                       // 1082
    if (this.isShown && this.options.backdrop) {                                                                       // 1083
      var doAnimate = $.support.transition && animate                                                                  // 1084
                                                                                                                       // 1085
      this.$backdrop = $('<div class="modal-backdrop ' + animate + '" />')                                             // 1086
        .prependTo(this.$element)                                                                                      // 1087
        .on('click.dismiss.bs.modal', $.proxy(function (e) {                                                           // 1088
          if (e.target !== e.currentTarget) return                                                                     // 1089
          this.options.backdrop == 'static'                                                                            // 1090
            ? this.$element[0].focus.call(this.$element[0])                                                            // 1091
            : this.hide.call(this)                                                                                     // 1092
        }, this))                                                                                                      // 1093
                                                                                                                       // 1094
      if (doAnimate) this.$backdrop[0].offsetWidth // force reflow                                                     // 1095
                                                                                                                       // 1096
      this.$backdrop.addClass('in')                                                                                    // 1097
                                                                                                                       // 1098
      if (!callback) return                                                                                            // 1099
                                                                                                                       // 1100
      doAnimate ?                                                                                                      // 1101
        this.$backdrop                                                                                                 // 1102
          .one('bsTransitionEnd', callback)                                                                            // 1103
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :                                                  // 1104
        callback()                                                                                                     // 1105
                                                                                                                       // 1106
    } else if (!this.isShown && this.$backdrop) {                                                                      // 1107
      this.$backdrop.removeClass('in')                                                                                 // 1108
                                                                                                                       // 1109
      var callbackRemove = function () {                                                                               // 1110
        that.removeBackdrop()                                                                                          // 1111
        callback && callback()                                                                                         // 1112
      }                                                                                                                // 1113
      $.support.transition && this.$element.hasClass('fade') ?                                                         // 1114
        this.$backdrop                                                                                                 // 1115
          .one('bsTransitionEnd', callbackRemove)                                                                      // 1116
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :                                                  // 1117
        callbackRemove()                                                                                               // 1118
                                                                                                                       // 1119
    } else if (callback) {                                                                                             // 1120
      callback()                                                                                                       // 1121
    }                                                                                                                  // 1122
  }                                                                                                                    // 1123
                                                                                                                       // 1124
  // these following methods are used to handle overflowing modals                                                     // 1125
                                                                                                                       // 1126
  Modal.prototype.handleUpdate = function () {                                                                         // 1127
    if (this.options.backdrop) this.adjustBackdrop()                                                                   // 1128
    this.adjustDialog()                                                                                                // 1129
  }                                                                                                                    // 1130
                                                                                                                       // 1131
  Modal.prototype.adjustBackdrop = function () {                                                                       // 1132
    this.$backdrop                                                                                                     // 1133
      .css('height', 0)                                                                                                // 1134
      .css('height', this.$element[0].scrollHeight)                                                                    // 1135
  }                                                                                                                    // 1136
                                                                                                                       // 1137
  Modal.prototype.adjustDialog = function () {                                                                         // 1138
    var modalIsOverflowing = this.$element[0].scrollHeight > document.documentElement.clientHeight                     // 1139
                                                                                                                       // 1140
    this.$element.css({                                                                                                // 1141
      paddingLeft:  !this.bodyIsOverflowing && modalIsOverflowing ? this.scrollbarWidth : '',                          // 1142
      paddingRight: this.bodyIsOverflowing && !modalIsOverflowing ? this.scrollbarWidth : ''                           // 1143
    })                                                                                                                 // 1144
  }                                                                                                                    // 1145
                                                                                                                       // 1146
  Modal.prototype.resetAdjustments = function () {                                                                     // 1147
    this.$element.css({                                                                                                // 1148
      paddingLeft: '',                                                                                                 // 1149
      paddingRight: ''                                                                                                 // 1150
    })                                                                                                                 // 1151
  }                                                                                                                    // 1152
                                                                                                                       // 1153
  Modal.prototype.checkScrollbar = function () {                                                                       // 1154
    this.bodyIsOverflowing = document.body.scrollHeight > document.documentElement.clientHeight                        // 1155
    this.scrollbarWidth = this.measureScrollbar()                                                                      // 1156
  }                                                                                                                    // 1157
                                                                                                                       // 1158
  Modal.prototype.setScrollbar = function () {                                                                         // 1159
    var bodyPad = parseInt((this.$body.css('padding-right') || 0), 10)                                                 // 1160
    if (this.bodyIsOverflowing) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)                         // 1161
  }                                                                                                                    // 1162
                                                                                                                       // 1163
  Modal.prototype.resetScrollbar = function () {                                                                       // 1164
    this.$body.css('padding-right', '')                                                                                // 1165
  }                                                                                                                    // 1166
                                                                                                                       // 1167
  Modal.prototype.measureScrollbar = function () { // thx walsh                                                        // 1168
    var scrollDiv = document.createElement('div')                                                                      // 1169
    scrollDiv.className = 'modal-scrollbar-measure'                                                                    // 1170
    this.$body.append(scrollDiv)                                                                                       // 1171
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth                                                 // 1172
    this.$body[0].removeChild(scrollDiv)                                                                               // 1173
    return scrollbarWidth                                                                                              // 1174
  }                                                                                                                    // 1175
                                                                                                                       // 1176
                                                                                                                       // 1177
  // MODAL PLUGIN DEFINITION                                                                                           // 1178
  // =======================                                                                                           // 1179
                                                                                                                       // 1180
  function Plugin(option, _relatedTarget) {                                                                            // 1181
    return this.each(function () {                                                                                     // 1182
      var $this   = $(this)                                                                                            // 1183
      var data    = $this.data('bs.modal')                                                                             // 1184
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option)                    // 1185
                                                                                                                       // 1186
      if (!data) $this.data('bs.modal', (data = new Modal(this, options)))                                             // 1187
      if (typeof option == 'string') data[option](_relatedTarget)                                                      // 1188
      else if (options.show) data.show(_relatedTarget)                                                                 // 1189
    })                                                                                                                 // 1190
  }                                                                                                                    // 1191
                                                                                                                       // 1192
  var old = $.fn.modal                                                                                                 // 1193
                                                                                                                       // 1194
  $.fn.modal             = Plugin                                                                                      // 1195
  $.fn.modal.Constructor = Modal                                                                                       // 1196
                                                                                                                       // 1197
                                                                                                                       // 1198
  // MODAL NO CONFLICT                                                                                                 // 1199
  // =================                                                                                                 // 1200
                                                                                                                       // 1201
  $.fn.modal.noConflict = function () {                                                                                // 1202
    $.fn.modal = old                                                                                                   // 1203
    return this                                                                                                        // 1204
  }                                                                                                                    // 1205
                                                                                                                       // 1206
                                                                                                                       // 1207
  // MODAL DATA-API                                                                                                    // 1208
  // ==============                                                                                                    // 1209
                                                                                                                       // 1210
  $(document).on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {                                    // 1211
    var $this   = $(this)                                                                                              // 1212
    var href    = $this.attr('href')                                                                                   // 1213
    var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) // strip for ie7        // 1214
    var option  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())
                                                                                                                       // 1216
    if ($this.is('a')) e.preventDefault()                                                                              // 1217
                                                                                                                       // 1218
    $target.one('show.bs.modal', function (showEvent) {                                                                // 1219
      if (showEvent.isDefaultPrevented()) return // only register focus restorer if modal will actually get shown      // 1220
      $target.one('hidden.bs.modal', function () {                                                                     // 1221
        $this.is(':visible') && $this.trigger('focus')                                                                 // 1222
      })                                                                                                               // 1223
    })                                                                                                                 // 1224
    Plugin.call($target, option, this)                                                                                 // 1225
  })                                                                                                                   // 1226
                                                                                                                       // 1227
}(jQuery);                                                                                                             // 1228
                                                                                                                       // 1229
/* ========================================================================                                            // 1230
 * Bootstrap: tooltip.js v3.3.1                                                                                        // 1231
 * http://getbootstrap.com/javascript/#tooltip                                                                         // 1232
 * Inspired by the original jQuery.tipsy by Jason Frame                                                                // 1233
 * ========================================================================                                            // 1234
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 1235
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 1236
 * ======================================================================== */                                         // 1237
                                                                                                                       // 1238
                                                                                                                       // 1239
+function ($) {                                                                                                        // 1240
  'use strict';                                                                                                        // 1241
                                                                                                                       // 1242
  // TOOLTIP PUBLIC CLASS DEFINITION                                                                                   // 1243
  // ===============================                                                                                   // 1244
                                                                                                                       // 1245
  var Tooltip = function (element, options) {                                                                          // 1246
    this.type       =                                                                                                  // 1247
    this.options    =                                                                                                  // 1248
    this.enabled    =                                                                                                  // 1249
    this.timeout    =                                                                                                  // 1250
    this.hoverState =                                                                                                  // 1251
    this.$element   = null                                                                                             // 1252
                                                                                                                       // 1253
    this.init('tooltip', element, options)                                                                             // 1254
  }                                                                                                                    // 1255
                                                                                                                       // 1256
  Tooltip.VERSION  = '3.3.1'                                                                                           // 1257
                                                                                                                       // 1258
  Tooltip.TRANSITION_DURATION = 150                                                                                    // 1259
                                                                                                                       // 1260
  Tooltip.DEFAULTS = {                                                                                                 // 1261
    animation: true,                                                                                                   // 1262
    placement: 'top',                                                                                                  // 1263
    selector: false,                                                                                                   // 1264
    template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',                                                                                            // 1266
    title: '',                                                                                                         // 1267
    delay: 0,                                                                                                          // 1268
    html: false,                                                                                                       // 1269
    container: false,                                                                                                  // 1270
    viewport: {                                                                                                        // 1271
      selector: 'body',                                                                                                // 1272
      padding: 0                                                                                                       // 1273
    }                                                                                                                  // 1274
  }                                                                                                                    // 1275
                                                                                                                       // 1276
  Tooltip.prototype.init = function (type, element, options) {                                                         // 1277
    this.enabled   = true                                                                                              // 1278
    this.type      = type                                                                                              // 1279
    this.$element  = $(element)                                                                                        // 1280
    this.options   = this.getOptions(options)                                                                          // 1281
    this.$viewport = this.options.viewport && $(this.options.viewport.selector || this.options.viewport)               // 1282
                                                                                                                       // 1283
    var triggers = this.options.trigger.split(' ')                                                                     // 1284
                                                                                                                       // 1285
    for (var i = triggers.length; i--;) {                                                                              // 1286
      var trigger = triggers[i]                                                                                        // 1287
                                                                                                                       // 1288
      if (trigger == 'click') {                                                                                        // 1289
        this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))                      // 1290
      } else if (trigger != 'manual') {                                                                                // 1291
        var eventIn  = trigger == 'hover' ? 'mouseenter' : 'focusin'                                                   // 1292
        var eventOut = trigger == 'hover' ? 'mouseleave' : 'focusout'                                                  // 1293
                                                                                                                       // 1294
        this.$element.on(eventIn  + '.' + this.type, this.options.selector, $.proxy(this.enter, this))                 // 1295
        this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))                 // 1296
      }                                                                                                                // 1297
    }                                                                                                                  // 1298
                                                                                                                       // 1299
    this.options.selector ?                                                                                            // 1300
      (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :                              // 1301
      this.fixTitle()                                                                                                  // 1302
  }                                                                                                                    // 1303
                                                                                                                       // 1304
  Tooltip.prototype.getDefaults = function () {                                                                        // 1305
    return Tooltip.DEFAULTS                                                                                            // 1306
  }                                                                                                                    // 1307
                                                                                                                       // 1308
  Tooltip.prototype.getOptions = function (options) {                                                                  // 1309
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)                                          // 1310
                                                                                                                       // 1311
    if (options.delay && typeof options.delay == 'number') {                                                           // 1312
      options.delay = {                                                                                                // 1313
        show: options.delay,                                                                                           // 1314
        hide: options.delay                                                                                            // 1315
      }                                                                                                                // 1316
    }                                                                                                                  // 1317
                                                                                                                       // 1318
    return options                                                                                                     // 1319
  }                                                                                                                    // 1320
                                                                                                                       // 1321
  Tooltip.prototype.getDelegateOptions = function () {                                                                 // 1322
    var options  = {}                                                                                                  // 1323
    var defaults = this.getDefaults()                                                                                  // 1324
                                                                                                                       // 1325
    this._options && $.each(this._options, function (key, value) {                                                     // 1326
      if (defaults[key] != value) options[key] = value                                                                 // 1327
    })                                                                                                                 // 1328
                                                                                                                       // 1329
    return options                                                                                                     // 1330
  }                                                                                                                    // 1331
                                                                                                                       // 1332
  Tooltip.prototype.enter = function (obj) {                                                                           // 1333
    var self = obj instanceof this.constructor ?                                                                       // 1334
      obj : $(obj.currentTarget).data('bs.' + this.type)                                                               // 1335
                                                                                                                       // 1336
    if (self && self.$tip && self.$tip.is(':visible')) {                                                               // 1337
      self.hoverState = 'in'                                                                                           // 1338
      return                                                                                                           // 1339
    }                                                                                                                  // 1340
                                                                                                                       // 1341
    if (!self) {                                                                                                       // 1342
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())                                        // 1343
      $(obj.currentTarget).data('bs.' + this.type, self)                                                               // 1344
    }                                                                                                                  // 1345
                                                                                                                       // 1346
    clearTimeout(self.timeout)                                                                                         // 1347
                                                                                                                       // 1348
    self.hoverState = 'in'                                                                                             // 1349
                                                                                                                       // 1350
    if (!self.options.delay || !self.options.delay.show) return self.show()                                            // 1351
                                                                                                                       // 1352
    self.timeout = setTimeout(function () {                                                                            // 1353
      if (self.hoverState == 'in') self.show()                                                                         // 1354
    }, self.options.delay.show)                                                                                        // 1355
  }                                                                                                                    // 1356
                                                                                                                       // 1357
  Tooltip.prototype.leave = function (obj) {                                                                           // 1358
    var self = obj instanceof this.constructor ?                                                                       // 1359
      obj : $(obj.currentTarget).data('bs.' + this.type)                                                               // 1360
                                                                                                                       // 1361
    if (!self) {                                                                                                       // 1362
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())                                        // 1363
      $(obj.currentTarget).data('bs.' + this.type, self)                                                               // 1364
    }                                                                                                                  // 1365
                                                                                                                       // 1366
    clearTimeout(self.timeout)                                                                                         // 1367
                                                                                                                       // 1368
    self.hoverState = 'out'                                                                                            // 1369
                                                                                                                       // 1370
    if (!self.options.delay || !self.options.delay.hide) return self.hide()                                            // 1371
                                                                                                                       // 1372
    self.timeout = setTimeout(function () {                                                                            // 1373
      if (self.hoverState == 'out') self.hide()                                                                        // 1374
    }, self.options.delay.hide)                                                                                        // 1375
  }                                                                                                                    // 1376
                                                                                                                       // 1377
  Tooltip.prototype.show = function () {                                                                               // 1378
    var e = $.Event('show.bs.' + this.type)                                                                            // 1379
                                                                                                                       // 1380
    if (this.hasContent() && this.enabled) {                                                                           // 1381
      this.$element.trigger(e)                                                                                         // 1382
                                                                                                                       // 1383
      var inDom = $.contains(this.$element[0].ownerDocument.documentElement, this.$element[0])                         // 1384
      if (e.isDefaultPrevented() || !inDom) return                                                                     // 1385
      var that = this                                                                                                  // 1386
                                                                                                                       // 1387
      var $tip = this.tip()                                                                                            // 1388
                                                                                                                       // 1389
      var tipId = this.getUID(this.type)                                                                               // 1390
                                                                                                                       // 1391
      this.setContent()                                                                                                // 1392
      $tip.attr('id', tipId)                                                                                           // 1393
      this.$element.attr('aria-describedby', tipId)                                                                    // 1394
                                                                                                                       // 1395
      if (this.options.animation) $tip.addClass('fade')                                                                // 1396
                                                                                                                       // 1397
      var placement = typeof this.options.placement == 'function' ?                                                    // 1398
        this.options.placement.call(this, $tip[0], this.$element[0]) :                                                 // 1399
        this.options.placement                                                                                         // 1400
                                                                                                                       // 1401
      var autoToken = /\s?auto?\s?/i                                                                                   // 1402
      var autoPlace = autoToken.test(placement)                                                                        // 1403
      if (autoPlace) placement = placement.replace(autoToken, '') || 'top'                                             // 1404
                                                                                                                       // 1405
      $tip                                                                                                             // 1406
        .detach()                                                                                                      // 1407
        .css({ top: 0, left: 0, display: 'block' })                                                                    // 1408
        .addClass(placement)                                                                                           // 1409
        .data('bs.' + this.type, this)                                                                                 // 1410
                                                                                                                       // 1411
      this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)                 // 1412
                                                                                                                       // 1413
      var pos          = this.getPosition()                                                                            // 1414
      var actualWidth  = $tip[0].offsetWidth                                                                           // 1415
      var actualHeight = $tip[0].offsetHeight                                                                          // 1416
                                                                                                                       // 1417
      if (autoPlace) {                                                                                                 // 1418
        var orgPlacement = placement                                                                                   // 1419
        var $container   = this.options.container ? $(this.options.container) : this.$element.parent()                 // 1420
        var containerDim = this.getPosition($container)                                                                // 1421
                                                                                                                       // 1422
        placement = placement == 'bottom' && pos.bottom + actualHeight > containerDim.bottom ? 'top'    :              // 1423
                    placement == 'top'    && pos.top    - actualHeight < containerDim.top    ? 'bottom' :              // 1424
                    placement == 'right'  && pos.right  + actualWidth  > containerDim.width  ? 'left'   :              // 1425
                    placement == 'left'   && pos.left   - actualWidth  < containerDim.left   ? 'right'  :              // 1426
                    placement                                                                                          // 1427
                                                                                                                       // 1428
        $tip                                                                                                           // 1429
          .removeClass(orgPlacement)                                                                                   // 1430
          .addClass(placement)                                                                                         // 1431
      }                                                                                                                // 1432
                                                                                                                       // 1433
      var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)                       // 1434
                                                                                                                       // 1435
      this.applyPlacement(calculatedOffset, placement)                                                                 // 1436
                                                                                                                       // 1437
      var complete = function () {                                                                                     // 1438
        var prevHoverState = that.hoverState                                                                           // 1439
        that.$element.trigger('shown.bs.' + that.type)                                                                 // 1440
        that.hoverState = null                                                                                         // 1441
                                                                                                                       // 1442
        if (prevHoverState == 'out') that.leave(that)                                                                  // 1443
      }                                                                                                                // 1444
                                                                                                                       // 1445
      $.support.transition && this.$tip.hasClass('fade') ?                                                             // 1446
        $tip                                                                                                           // 1447
          .one('bsTransitionEnd', complete)                                                                            // 1448
          .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :                                                         // 1449
        complete()                                                                                                     // 1450
    }                                                                                                                  // 1451
  }                                                                                                                    // 1452
                                                                                                                       // 1453
  Tooltip.prototype.applyPlacement = function (offset, placement) {                                                    // 1454
    var $tip   = this.tip()                                                                                            // 1455
    var width  = $tip[0].offsetWidth                                                                                   // 1456
    var height = $tip[0].offsetHeight                                                                                  // 1457
                                                                                                                       // 1458
    // manually read margins because getBoundingClientRect includes difference                                         // 1459
    var marginTop = parseInt($tip.css('margin-top'), 10)                                                               // 1460
    var marginLeft = parseInt($tip.css('margin-left'), 10)                                                             // 1461
                                                                                                                       // 1462
    // we must check for NaN for ie 8/9                                                                                // 1463
    if (isNaN(marginTop))  marginTop  = 0                                                                              // 1464
    if (isNaN(marginLeft)) marginLeft = 0                                                                              // 1465
                                                                                                                       // 1466
    offset.top  = offset.top  + marginTop                                                                              // 1467
    offset.left = offset.left + marginLeft                                                                             // 1468
                                                                                                                       // 1469
    // $.fn.offset doesn't round pixel values                                                                          // 1470
    // so we use setOffset directly with our own function B-0                                                          // 1471
    $.offset.setOffset($tip[0], $.extend({                                                                             // 1472
      using: function (props) {                                                                                        // 1473
        $tip.css({                                                                                                     // 1474
          top: Math.round(props.top),                                                                                  // 1475
          left: Math.round(props.left)                                                                                 // 1476
        })                                                                                                             // 1477
      }                                                                                                                // 1478
    }, offset), 0)                                                                                                     // 1479
                                                                                                                       // 1480
    $tip.addClass('in')                                                                                                // 1481
                                                                                                                       // 1482
    // check to see if placing tip in new offset caused the tip to resize itself                                       // 1483
    var actualWidth  = $tip[0].offsetWidth                                                                             // 1484
    var actualHeight = $tip[0].offsetHeight                                                                            // 1485
                                                                                                                       // 1486
    if (placement == 'top' && actualHeight != height) {                                                                // 1487
      offset.top = offset.top + height - actualHeight                                                                  // 1488
    }                                                                                                                  // 1489
                                                                                                                       // 1490
    var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)                            // 1491
                                                                                                                       // 1492
    if (delta.left) offset.left += delta.left                                                                          // 1493
    else offset.top += delta.top                                                                                       // 1494
                                                                                                                       // 1495
    var isVertical          = /top|bottom/.test(placement)                                                             // 1496
    var arrowDelta          = isVertical ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
    var arrowOffsetPosition = isVertical ? 'offsetWidth' : 'offsetHeight'                                              // 1498
                                                                                                                       // 1499
    $tip.offset(offset)                                                                                                // 1500
    this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], isVertical)                                            // 1501
  }                                                                                                                    // 1502
                                                                                                                       // 1503
  Tooltip.prototype.replaceArrow = function (delta, dimension, isHorizontal) {                                         // 1504
    this.arrow()                                                                                                       // 1505
      .css(isHorizontal ? 'left' : 'top', 50 * (1 - delta / dimension) + '%')                                          // 1506
      .css(isHorizontal ? 'top' : 'left', '')                                                                          // 1507
  }                                                                                                                    // 1508
                                                                                                                       // 1509
  Tooltip.prototype.setContent = function () {                                                                         // 1510
    var $tip  = this.tip()                                                                                             // 1511
    var title = this.getTitle()                                                                                        // 1512
                                                                                                                       // 1513
    $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)                                            // 1514
    $tip.removeClass('fade in top bottom left right')                                                                  // 1515
  }                                                                                                                    // 1516
                                                                                                                       // 1517
  Tooltip.prototype.hide = function (callback) {                                                                       // 1518
    var that = this                                                                                                    // 1519
    var $tip = this.tip()                                                                                              // 1520
    var e    = $.Event('hide.bs.' + this.type)                                                                         // 1521
                                                                                                                       // 1522
    function complete() {                                                                                              // 1523
      if (that.hoverState != 'in') $tip.detach()                                                                       // 1524
      that.$element                                                                                                    // 1525
        .removeAttr('aria-describedby')                                                                                // 1526
        .trigger('hidden.bs.' + that.type)                                                                             // 1527
      callback && callback()                                                                                           // 1528
    }                                                                                                                  // 1529
                                                                                                                       // 1530
    this.$element.trigger(e)                                                                                           // 1531
                                                                                                                       // 1532
    if (e.isDefaultPrevented()) return                                                                                 // 1533
                                                                                                                       // 1534
    $tip.removeClass('in')                                                                                             // 1535
                                                                                                                       // 1536
    $.support.transition && this.$tip.hasClass('fade') ?                                                               // 1537
      $tip                                                                                                             // 1538
        .one('bsTransitionEnd', complete)                                                                              // 1539
        .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :                                                           // 1540
      complete()                                                                                                       // 1541
                                                                                                                       // 1542
    this.hoverState = null                                                                                             // 1543
                                                                                                                       // 1544
    return this                                                                                                        // 1545
  }                                                                                                                    // 1546
                                                                                                                       // 1547
  Tooltip.prototype.fixTitle = function () {                                                                           // 1548
    var $e = this.$element                                                                                             // 1549
    if ($e.attr('title') || typeof ($e.attr('data-original-title')) != 'string') {                                     // 1550
      $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')                                         // 1551
    }                                                                                                                  // 1552
  }                                                                                                                    // 1553
                                                                                                                       // 1554
  Tooltip.prototype.hasContent = function () {                                                                         // 1555
    return this.getTitle()                                                                                             // 1556
  }                                                                                                                    // 1557
                                                                                                                       // 1558
  Tooltip.prototype.getPosition = function ($element) {                                                                // 1559
    $element   = $element || this.$element                                                                             // 1560
                                                                                                                       // 1561
    var el     = $element[0]                                                                                           // 1562
    var isBody = el.tagName == 'BODY'                                                                                  // 1563
                                                                                                                       // 1564
    var elRect    = el.getBoundingClientRect()                                                                         // 1565
    if (elRect.width == null) {                                                                                        // 1566
      // width and height are missing in IE8, so compute them manually; see https://github.com/twbs/bootstrap/issues/14093
      elRect = $.extend({}, elRect, { width: elRect.right - elRect.left, height: elRect.bottom - elRect.top })         // 1568
    }                                                                                                                  // 1569
    var elOffset  = isBody ? { top: 0, left: 0 } : $element.offset()                                                   // 1570
    var scroll    = { scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop() }
    var outerDims = isBody ? { width: $(window).width(), height: $(window).height() } : null                           // 1572
                                                                                                                       // 1573
    return $.extend({}, elRect, scroll, outerDims, elOffset)                                                           // 1574
  }                                                                                                                    // 1575
                                                                                                                       // 1576
  Tooltip.prototype.getCalculatedOffset = function (placement, pos, actualWidth, actualHeight) {                       // 1577
    return placement == 'bottom' ? { top: pos.top + pos.height,   left: pos.left + pos.width / 2 - actualWidth / 2  } :
           placement == 'top'    ? { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2  } :
           placement == 'left'   ? { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth } :
        /* placement == 'right' */ { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width   }  // 1581
                                                                                                                       // 1582
  }                                                                                                                    // 1583
                                                                                                                       // 1584
  Tooltip.prototype.getViewportAdjustedDelta = function (placement, pos, actualWidth, actualHeight) {                  // 1585
    var delta = { top: 0, left: 0 }                                                                                    // 1586
    if (!this.$viewport) return delta                                                                                  // 1587
                                                                                                                       // 1588
    var viewportPadding = this.options.viewport && this.options.viewport.padding || 0                                  // 1589
    var viewportDimensions = this.getPosition(this.$viewport)                                                          // 1590
                                                                                                                       // 1591
    if (/right|left/.test(placement)) {                                                                                // 1592
      var topEdgeOffset    = pos.top - viewportPadding - viewportDimensions.scroll                                     // 1593
      var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight                      // 1594
      if (topEdgeOffset < viewportDimensions.top) { // top overflow                                                    // 1595
        delta.top = viewportDimensions.top - topEdgeOffset                                                             // 1596
      } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) { // bottom overflow           // 1597
        delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset                              // 1598
      }                                                                                                                // 1599
    } else {                                                                                                           // 1600
      var leftEdgeOffset  = pos.left - viewportPadding                                                                 // 1601
      var rightEdgeOffset = pos.left + viewportPadding + actualWidth                                                   // 1602
      if (leftEdgeOffset < viewportDimensions.left) { // left overflow                                                 // 1603
        delta.left = viewportDimensions.left - leftEdgeOffset                                                          // 1604
      } else if (rightEdgeOffset > viewportDimensions.width) { // right overflow                                       // 1605
        delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset                              // 1606
      }                                                                                                                // 1607
    }                                                                                                                  // 1608
                                                                                                                       // 1609
    return delta                                                                                                       // 1610
  }                                                                                                                    // 1611
                                                                                                                       // 1612
  Tooltip.prototype.getTitle = function () {                                                                           // 1613
    var title                                                                                                          // 1614
    var $e = this.$element                                                                                             // 1615
    var o  = this.options                                                                                              // 1616
                                                                                                                       // 1617
    title = $e.attr('data-original-title')                                                                             // 1618
      || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)                                               // 1619
                                                                                                                       // 1620
    return title                                                                                                       // 1621
  }                                                                                                                    // 1622
                                                                                                                       // 1623
  Tooltip.prototype.getUID = function (prefix) {                                                                       // 1624
    do prefix += ~~(Math.random() * 1000000)                                                                           // 1625
    while (document.getElementById(prefix))                                                                            // 1626
    return prefix                                                                                                      // 1627
  }                                                                                                                    // 1628
                                                                                                                       // 1629
  Tooltip.prototype.tip = function () {                                                                                // 1630
    return (this.$tip = this.$tip || $(this.options.template))                                                         // 1631
  }                                                                                                                    // 1632
                                                                                                                       // 1633
  Tooltip.prototype.arrow = function () {                                                                              // 1634
    return (this.$arrow = this.$arrow || this.tip().find('.tooltip-arrow'))                                            // 1635
  }                                                                                                                    // 1636
                                                                                                                       // 1637
  Tooltip.prototype.enable = function () {                                                                             // 1638
    this.enabled = true                                                                                                // 1639
  }                                                                                                                    // 1640
                                                                                                                       // 1641
  Tooltip.prototype.disable = function () {                                                                            // 1642
    this.enabled = false                                                                                               // 1643
  }                                                                                                                    // 1644
                                                                                                                       // 1645
  Tooltip.prototype.toggleEnabled = function () {                                                                      // 1646
    this.enabled = !this.enabled                                                                                       // 1647
  }                                                                                                                    // 1648
                                                                                                                       // 1649
  Tooltip.prototype.toggle = function (e) {                                                                            // 1650
    var self = this                                                                                                    // 1651
    if (e) {                                                                                                           // 1652
      self = $(e.currentTarget).data('bs.' + this.type)                                                                // 1653
      if (!self) {                                                                                                     // 1654
        self = new this.constructor(e.currentTarget, this.getDelegateOptions())                                        // 1655
        $(e.currentTarget).data('bs.' + this.type, self)                                                               // 1656
      }                                                                                                                // 1657
    }                                                                                                                  // 1658
                                                                                                                       // 1659
    self.tip().hasClass('in') ? self.leave(self) : self.enter(self)                                                    // 1660
  }                                                                                                                    // 1661
                                                                                                                       // 1662
  Tooltip.prototype.destroy = function () {                                                                            // 1663
    var that = this                                                                                                    // 1664
    clearTimeout(this.timeout)                                                                                         // 1665
    this.hide(function () {                                                                                            // 1666
      that.$element.off('.' + that.type).removeData('bs.' + that.type)                                                 // 1667
    })                                                                                                                 // 1668
  }                                                                                                                    // 1669
                                                                                                                       // 1670
                                                                                                                       // 1671
  // TOOLTIP PLUGIN DEFINITION                                                                                         // 1672
  // =========================                                                                                         // 1673
                                                                                                                       // 1674
  function Plugin(option) {                                                                                            // 1675
    return this.each(function () {                                                                                     // 1676
      var $this    = $(this)                                                                                           // 1677
      var data     = $this.data('bs.tooltip')                                                                          // 1678
      var options  = typeof option == 'object' && option                                                               // 1679
      var selector = options && options.selector                                                                       // 1680
                                                                                                                       // 1681
      if (!data && option == 'destroy') return                                                                         // 1682
      if (selector) {                                                                                                  // 1683
        if (!data) $this.data('bs.tooltip', (data = {}))                                                               // 1684
        if (!data[selector]) data[selector] = new Tooltip(this, options)                                               // 1685
      } else {                                                                                                         // 1686
        if (!data) $this.data('bs.tooltip', (data = new Tooltip(this, options)))                                       // 1687
      }                                                                                                                // 1688
      if (typeof option == 'string') data[option]()                                                                    // 1689
    })                                                                                                                 // 1690
  }                                                                                                                    // 1691
                                                                                                                       // 1692
  var old = $.fn.tooltip                                                                                               // 1693
                                                                                                                       // 1694
  $.fn.tooltip             = Plugin                                                                                    // 1695
  $.fn.tooltip.Constructor = Tooltip                                                                                   // 1696
                                                                                                                       // 1697
                                                                                                                       // 1698
  // TOOLTIP NO CONFLICT                                                                                               // 1699
  // ===================                                                                                               // 1700
                                                                                                                       // 1701
  $.fn.tooltip.noConflict = function () {                                                                              // 1702
    $.fn.tooltip = old                                                                                                 // 1703
    return this                                                                                                        // 1704
  }                                                                                                                    // 1705
                                                                                                                       // 1706
}(jQuery);                                                                                                             // 1707
                                                                                                                       // 1708
/* ========================================================================                                            // 1709
 * Bootstrap: popover.js v3.3.1                                                                                        // 1710
 * http://getbootstrap.com/javascript/#popovers                                                                        // 1711
 * ========================================================================                                            // 1712
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 1713
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 1714
 * ======================================================================== */                                         // 1715
                                                                                                                       // 1716
                                                                                                                       // 1717
+function ($) {                                                                                                        // 1718
  'use strict';                                                                                                        // 1719
                                                                                                                       // 1720
  // POPOVER PUBLIC CLASS DEFINITION                                                                                   // 1721
  // ===============================                                                                                   // 1722
                                                                                                                       // 1723
  var Popover = function (element, options) {                                                                          // 1724
    this.init('popover', element, options)                                                                             // 1725
  }                                                                                                                    // 1726
                                                                                                                       // 1727
  if (!$.fn.tooltip) throw new Error('Popover requires tooltip.js')                                                    // 1728
                                                                                                                       // 1729
  Popover.VERSION  = '3.3.1'                                                                                           // 1730
                                                                                                                       // 1731
  Popover.DEFAULTS = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, {                                                 // 1732
    placement: 'right',                                                                                                // 1733
    trigger: 'click',                                                                                                  // 1734
    content: '',                                                                                                       // 1735
    template: '<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
  })                                                                                                                   // 1737
                                                                                                                       // 1738
                                                                                                                       // 1739
  // NOTE: POPOVER EXTENDS tooltip.js                                                                                  // 1740
  // ================================                                                                                  // 1741
                                                                                                                       // 1742
  Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype)                                                 // 1743
                                                                                                                       // 1744
  Popover.prototype.constructor = Popover                                                                              // 1745
                                                                                                                       // 1746
  Popover.prototype.getDefaults = function () {                                                                        // 1747
    return Popover.DEFAULTS                                                                                            // 1748
  }                                                                                                                    // 1749
                                                                                                                       // 1750
  Popover.prototype.setContent = function () {                                                                         // 1751
    var $tip    = this.tip()                                                                                           // 1752
    var title   = this.getTitle()                                                                                      // 1753
    var content = this.getContent()                                                                                    // 1754
                                                                                                                       // 1755
    $tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)                                            // 1756
    $tip.find('.popover-content').children().detach().end()[ // we use append for html objects to maintain js events   // 1757
      this.options.html ? (typeof content == 'string' ? 'html' : 'append') : 'text'                                    // 1758
    ](content)                                                                                                         // 1759
                                                                                                                       // 1760
    $tip.removeClass('fade top bottom left right in')                                                                  // 1761
                                                                                                                       // 1762
    // IE8 doesn't accept hiding via the `:empty` pseudo selector, we have to do                                       // 1763
    // this manually by checking the contents.                                                                         // 1764
    if (!$tip.find('.popover-title').html()) $tip.find('.popover-title').hide()                                        // 1765
  }                                                                                                                    // 1766
                                                                                                                       // 1767
  Popover.prototype.hasContent = function () {                                                                         // 1768
    return this.getTitle() || this.getContent()                                                                        // 1769
  }                                                                                                                    // 1770
                                                                                                                       // 1771
  Popover.prototype.getContent = function () {                                                                         // 1772
    var $e = this.$element                                                                                             // 1773
    var o  = this.options                                                                                              // 1774
                                                                                                                       // 1775
    return $e.attr('data-content')                                                                                     // 1776
      || (typeof o.content == 'function' ?                                                                             // 1777
            o.content.call($e[0]) :                                                                                    // 1778
            o.content)                                                                                                 // 1779
  }                                                                                                                    // 1780
                                                                                                                       // 1781
  Popover.prototype.arrow = function () {                                                                              // 1782
    return (this.$arrow = this.$arrow || this.tip().find('.arrow'))                                                    // 1783
  }                                                                                                                    // 1784
                                                                                                                       // 1785
  Popover.prototype.tip = function () {                                                                                // 1786
    if (!this.$tip) this.$tip = $(this.options.template)                                                               // 1787
    return this.$tip                                                                                                   // 1788
  }                                                                                                                    // 1789
                                                                                                                       // 1790
                                                                                                                       // 1791
  // POPOVER PLUGIN DEFINITION                                                                                         // 1792
  // =========================                                                                                         // 1793
                                                                                                                       // 1794
  function Plugin(option) {                                                                                            // 1795
    return this.each(function () {                                                                                     // 1796
      var $this    = $(this)                                                                                           // 1797
      var data     = $this.data('bs.popover')                                                                          // 1798
      var options  = typeof option == 'object' && option                                                               // 1799
      var selector = options && options.selector                                                                       // 1800
                                                                                                                       // 1801
      if (!data && option == 'destroy') return                                                                         // 1802
      if (selector) {                                                                                                  // 1803
        if (!data) $this.data('bs.popover', (data = {}))                                                               // 1804
        if (!data[selector]) data[selector] = new Popover(this, options)                                               // 1805
      } else {                                                                                                         // 1806
        if (!data) $this.data('bs.popover', (data = new Popover(this, options)))                                       // 1807
      }                                                                                                                // 1808
      if (typeof option == 'string') data[option]()                                                                    // 1809
    })                                                                                                                 // 1810
  }                                                                                                                    // 1811
                                                                                                                       // 1812
  var old = $.fn.popover                                                                                               // 1813
                                                                                                                       // 1814
  $.fn.popover             = Plugin                                                                                    // 1815
  $.fn.popover.Constructor = Popover                                                                                   // 1816
                                                                                                                       // 1817
                                                                                                                       // 1818
  // POPOVER NO CONFLICT                                                                                               // 1819
  // ===================                                                                                               // 1820
                                                                                                                       // 1821
  $.fn.popover.noConflict = function () {                                                                              // 1822
    $.fn.popover = old                                                                                                 // 1823
    return this                                                                                                        // 1824
  }                                                                                                                    // 1825
                                                                                                                       // 1826
}(jQuery);                                                                                                             // 1827
                                                                                                                       // 1828
/* ========================================================================                                            // 1829
 * Bootstrap: scrollspy.js v3.3.1                                                                                      // 1830
 * http://getbootstrap.com/javascript/#scrollspy                                                                       // 1831
 * ========================================================================                                            // 1832
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 1833
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 1834
 * ======================================================================== */                                         // 1835
                                                                                                                       // 1836
                                                                                                                       // 1837
+function ($) {                                                                                                        // 1838
  'use strict';                                                                                                        // 1839
                                                                                                                       // 1840
  // SCROLLSPY CLASS DEFINITION                                                                                        // 1841
  // ==========================                                                                                        // 1842
                                                                                                                       // 1843
  function ScrollSpy(element, options) {                                                                               // 1844
    var process  = $.proxy(this.process, this)                                                                         // 1845
                                                                                                                       // 1846
    this.$body          = $('body')                                                                                    // 1847
    this.$scrollElement = $(element).is('body') ? $(window) : $(element)                                               // 1848
    this.options        = $.extend({}, ScrollSpy.DEFAULTS, options)                                                    // 1849
    this.selector       = (this.options.target || '') + ' .nav li > a'                                                 // 1850
    this.offsets        = []                                                                                           // 1851
    this.targets        = []                                                                                           // 1852
    this.activeTarget   = null                                                                                         // 1853
    this.scrollHeight   = 0                                                                                            // 1854
                                                                                                                       // 1855
    this.$scrollElement.on('scroll.bs.scrollspy', process)                                                             // 1856
    this.refresh()                                                                                                     // 1857
    this.process()                                                                                                     // 1858
  }                                                                                                                    // 1859
                                                                                                                       // 1860
  ScrollSpy.VERSION  = '3.3.1'                                                                                         // 1861
                                                                                                                       // 1862
  ScrollSpy.DEFAULTS = {                                                                                               // 1863
    offset: 10                                                                                                         // 1864
  }                                                                                                                    // 1865
                                                                                                                       // 1866
  ScrollSpy.prototype.getScrollHeight = function () {                                                                  // 1867
    return this.$scrollElement[0].scrollHeight || Math.max(this.$body[0].scrollHeight, document.documentElement.scrollHeight)
  }                                                                                                                    // 1869
                                                                                                                       // 1870
  ScrollSpy.prototype.refresh = function () {                                                                          // 1871
    var offsetMethod = 'offset'                                                                                        // 1872
    var offsetBase   = 0                                                                                               // 1873
                                                                                                                       // 1874
    if (!$.isWindow(this.$scrollElement[0])) {                                                                         // 1875
      offsetMethod = 'position'                                                                                        // 1876
      offsetBase   = this.$scrollElement.scrollTop()                                                                   // 1877
    }                                                                                                                  // 1878
                                                                                                                       // 1879
    this.offsets = []                                                                                                  // 1880
    this.targets = []                                                                                                  // 1881
    this.scrollHeight = this.getScrollHeight()                                                                         // 1882
                                                                                                                       // 1883
    var self     = this                                                                                                // 1884
                                                                                                                       // 1885
    this.$body                                                                                                         // 1886
      .find(this.selector)                                                                                             // 1887
      .map(function () {                                                                                               // 1888
        var $el   = $(this)                                                                                            // 1889
        var href  = $el.data('target') || $el.attr('href')                                                             // 1890
        var $href = /^#./.test(href) && $(href)                                                                        // 1891
                                                                                                                       // 1892
        return ($href                                                                                                  // 1893
          && $href.length                                                                                              // 1894
          && $href.is(':visible')                                                                                      // 1895
          && [[$href[offsetMethod]().top + offsetBase, href]]) || null                                                 // 1896
      })                                                                                                               // 1897
      .sort(function (a, b) { return a[0] - b[0] })                                                                    // 1898
      .each(function () {                                                                                              // 1899
        self.offsets.push(this[0])                                                                                     // 1900
        self.targets.push(this[1])                                                                                     // 1901
      })                                                                                                               // 1902
  }                                                                                                                    // 1903
                                                                                                                       // 1904
  ScrollSpy.prototype.process = function () {                                                                          // 1905
    var scrollTop    = this.$scrollElement.scrollTop() + this.options.offset                                           // 1906
    var scrollHeight = this.getScrollHeight()                                                                          // 1907
    var maxScroll    = this.options.offset + scrollHeight - this.$scrollElement.height()                               // 1908
    var offsets      = this.offsets                                                                                    // 1909
    var targets      = this.targets                                                                                    // 1910
    var activeTarget = this.activeTarget                                                                               // 1911
    var i                                                                                                              // 1912
                                                                                                                       // 1913
    if (this.scrollHeight != scrollHeight) {                                                                           // 1914
      this.refresh()                                                                                                   // 1915
    }                                                                                                                  // 1916
                                                                                                                       // 1917
    if (scrollTop >= maxScroll) {                                                                                      // 1918
      return activeTarget != (i = targets[targets.length - 1]) && this.activate(i)                                     // 1919
    }                                                                                                                  // 1920
                                                                                                                       // 1921
    if (activeTarget && scrollTop < offsets[0]) {                                                                      // 1922
      this.activeTarget = null                                                                                         // 1923
      return this.clear()                                                                                              // 1924
    }                                                                                                                  // 1925
                                                                                                                       // 1926
    for (i = offsets.length; i--;) {                                                                                   // 1927
      activeTarget != targets[i]                                                                                       // 1928
        && scrollTop >= offsets[i]                                                                                     // 1929
        && (!offsets[i + 1] || scrollTop <= offsets[i + 1])                                                            // 1930
        && this.activate(targets[i])                                                                                   // 1931
    }                                                                                                                  // 1932
  }                                                                                                                    // 1933
                                                                                                                       // 1934
  ScrollSpy.prototype.activate = function (target) {                                                                   // 1935
    this.activeTarget = target                                                                                         // 1936
                                                                                                                       // 1937
    this.clear()                                                                                                       // 1938
                                                                                                                       // 1939
    var selector = this.selector +                                                                                     // 1940
        '[data-target="' + target + '"],' +                                                                            // 1941
        this.selector + '[href="' + target + '"]'                                                                      // 1942
                                                                                                                       // 1943
    var active = $(selector)                                                                                           // 1944
      .parents('li')                                                                                                   // 1945
      .addClass('active')                                                                                              // 1946
                                                                                                                       // 1947
    if (active.parent('.dropdown-menu').length) {                                                                      // 1948
      active = active                                                                                                  // 1949
        .closest('li.dropdown')                                                                                        // 1950
        .addClass('active')                                                                                            // 1951
    }                                                                                                                  // 1952
                                                                                                                       // 1953
    active.trigger('activate.bs.scrollspy')                                                                            // 1954
  }                                                                                                                    // 1955
                                                                                                                       // 1956
  ScrollSpy.prototype.clear = function () {                                                                            // 1957
    $(this.selector)                                                                                                   // 1958
      .parentsUntil(this.options.target, '.active')                                                                    // 1959
      .removeClass('active')                                                                                           // 1960
  }                                                                                                                    // 1961
                                                                                                                       // 1962
                                                                                                                       // 1963
  // SCROLLSPY PLUGIN DEFINITION                                                                                       // 1964
  // ===========================                                                                                       // 1965
                                                                                                                       // 1966
  function Plugin(option) {                                                                                            // 1967
    return this.each(function () {                                                                                     // 1968
      var $this   = $(this)                                                                                            // 1969
      var data    = $this.data('bs.scrollspy')                                                                         // 1970
      var options = typeof option == 'object' && option                                                                // 1971
                                                                                                                       // 1972
      if (!data) $this.data('bs.scrollspy', (data = new ScrollSpy(this, options)))                                     // 1973
      if (typeof option == 'string') data[option]()                                                                    // 1974
    })                                                                                                                 // 1975
  }                                                                                                                    // 1976
                                                                                                                       // 1977
  var old = $.fn.scrollspy                                                                                             // 1978
                                                                                                                       // 1979
  $.fn.scrollspy             = Plugin                                                                                  // 1980
  $.fn.scrollspy.Constructor = ScrollSpy                                                                               // 1981
                                                                                                                       // 1982
                                                                                                                       // 1983
  // SCROLLSPY NO CONFLICT                                                                                             // 1984
  // =====================                                                                                             // 1985
                                                                                                                       // 1986
  $.fn.scrollspy.noConflict = function () {                                                                            // 1987
    $.fn.scrollspy = old                                                                                               // 1988
    return this                                                                                                        // 1989
  }                                                                                                                    // 1990
                                                                                                                       // 1991
                                                                                                                       // 1992
  // SCROLLSPY DATA-API                                                                                                // 1993
  // ==================                                                                                                // 1994
                                                                                                                       // 1995
  $(window).on('load.bs.scrollspy.data-api', function () {                                                             // 1996
    $('[data-spy="scroll"]').each(function () {                                                                        // 1997
      var $spy = $(this)                                                                                               // 1998
      Plugin.call($spy, $spy.data())                                                                                   // 1999
    })                                                                                                                 // 2000
  })                                                                                                                   // 2001
                                                                                                                       // 2002
}(jQuery);                                                                                                             // 2003
                                                                                                                       // 2004
/* ========================================================================                                            // 2005
 * Bootstrap: tab.js v3.3.1                                                                                            // 2006
 * http://getbootstrap.com/javascript/#tabs                                                                            // 2007
 * ========================================================================                                            // 2008
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 2009
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 2010
 * ======================================================================== */                                         // 2011
                                                                                                                       // 2012
                                                                                                                       // 2013
+function ($) {                                                                                                        // 2014
  'use strict';                                                                                                        // 2015
                                                                                                                       // 2016
  // TAB CLASS DEFINITION                                                                                              // 2017
  // ====================                                                                                              // 2018
                                                                                                                       // 2019
  var Tab = function (element) {                                                                                       // 2020
    this.element = $(element)                                                                                          // 2021
  }                                                                                                                    // 2022
                                                                                                                       // 2023
  Tab.VERSION = '3.3.1'                                                                                                // 2024
                                                                                                                       // 2025
  Tab.TRANSITION_DURATION = 150                                                                                        // 2026
                                                                                                                       // 2027
  Tab.prototype.show = function () {                                                                                   // 2028
    var $this    = this.element                                                                                        // 2029
    var $ul      = $this.closest('ul:not(.dropdown-menu)')                                                             // 2030
    var selector = $this.data('target')                                                                                // 2031
                                                                                                                       // 2032
    if (!selector) {                                                                                                   // 2033
      selector = $this.attr('href')                                                                                    // 2034
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7                                   // 2035
    }                                                                                                                  // 2036
                                                                                                                       // 2037
    if ($this.parent('li').hasClass('active')) return                                                                  // 2038
                                                                                                                       // 2039
    var $previous = $ul.find('.active:last a')                                                                         // 2040
    var hideEvent = $.Event('hide.bs.tab', {                                                                           // 2041
      relatedTarget: $this[0]                                                                                          // 2042
    })                                                                                                                 // 2043
    var showEvent = $.Event('show.bs.tab', {                                                                           // 2044
      relatedTarget: $previous[0]                                                                                      // 2045
    })                                                                                                                 // 2046
                                                                                                                       // 2047
    $previous.trigger(hideEvent)                                                                                       // 2048
    $this.trigger(showEvent)                                                                                           // 2049
                                                                                                                       // 2050
    if (showEvent.isDefaultPrevented() || hideEvent.isDefaultPrevented()) return                                       // 2051
                                                                                                                       // 2052
    var $target = $(selector)                                                                                          // 2053
                                                                                                                       // 2054
    this.activate($this.closest('li'), $ul)                                                                            // 2055
    this.activate($target, $target.parent(), function () {                                                             // 2056
      $previous.trigger({                                                                                              // 2057
        type: 'hidden.bs.tab',                                                                                         // 2058
        relatedTarget: $this[0]                                                                                        // 2059
      })                                                                                                               // 2060
      $this.trigger({                                                                                                  // 2061
        type: 'shown.bs.tab',                                                                                          // 2062
        relatedTarget: $previous[0]                                                                                    // 2063
      })                                                                                                               // 2064
    })                                                                                                                 // 2065
  }                                                                                                                    // 2066
                                                                                                                       // 2067
  Tab.prototype.activate = function (element, container, callback) {                                                   // 2068
    var $active    = container.find('> .active')                                                                       // 2069
    var transition = callback                                                                                          // 2070
      && $.support.transition                                                                                          // 2071
      && (($active.length && $active.hasClass('fade')) || !!container.find('> .fade').length)                          // 2072
                                                                                                                       // 2073
    function next() {                                                                                                  // 2074
      $active                                                                                                          // 2075
        .removeClass('active')                                                                                         // 2076
        .find('> .dropdown-menu > .active')                                                                            // 2077
          .removeClass('active')                                                                                       // 2078
        .end()                                                                                                         // 2079
        .find('[data-toggle="tab"]')                                                                                   // 2080
          .attr('aria-expanded', false)                                                                                // 2081
                                                                                                                       // 2082
      element                                                                                                          // 2083
        .addClass('active')                                                                                            // 2084
        .find('[data-toggle="tab"]')                                                                                   // 2085
          .attr('aria-expanded', true)                                                                                 // 2086
                                                                                                                       // 2087
      if (transition) {                                                                                                // 2088
        element[0].offsetWidth // reflow for transition                                                                // 2089
        element.addClass('in')                                                                                         // 2090
      } else {                                                                                                         // 2091
        element.removeClass('fade')                                                                                    // 2092
      }                                                                                                                // 2093
                                                                                                                       // 2094
      if (element.parent('.dropdown-menu')) {                                                                          // 2095
        element                                                                                                        // 2096
          .closest('li.dropdown')                                                                                      // 2097
            .addClass('active')                                                                                        // 2098
          .end()                                                                                                       // 2099
          .find('[data-toggle="tab"]')                                                                                 // 2100
            .attr('aria-expanded', true)                                                                               // 2101
      }                                                                                                                // 2102
                                                                                                                       // 2103
      callback && callback()                                                                                           // 2104
    }                                                                                                                  // 2105
                                                                                                                       // 2106
    $active.length && transition ?                                                                                     // 2107
      $active                                                                                                          // 2108
        .one('bsTransitionEnd', next)                                                                                  // 2109
        .emulateTransitionEnd(Tab.TRANSITION_DURATION) :                                                               // 2110
      next()                                                                                                           // 2111
                                                                                                                       // 2112
    $active.removeClass('in')                                                                                          // 2113
  }                                                                                                                    // 2114
                                                                                                                       // 2115
                                                                                                                       // 2116
  // TAB PLUGIN DEFINITION                                                                                             // 2117
  // =====================                                                                                             // 2118
                                                                                                                       // 2119
  function Plugin(option) {                                                                                            // 2120
    return this.each(function () {                                                                                     // 2121
      var $this = $(this)                                                                                              // 2122
      var data  = $this.data('bs.tab')                                                                                 // 2123
                                                                                                                       // 2124
      if (!data) $this.data('bs.tab', (data = new Tab(this)))                                                          // 2125
      if (typeof option == 'string') data[option]()                                                                    // 2126
    })                                                                                                                 // 2127
  }                                                                                                                    // 2128
                                                                                                                       // 2129
  var old = $.fn.tab                                                                                                   // 2130
                                                                                                                       // 2131
  $.fn.tab             = Plugin                                                                                        // 2132
  $.fn.tab.Constructor = Tab                                                                                           // 2133
                                                                                                                       // 2134
                                                                                                                       // 2135
  // TAB NO CONFLICT                                                                                                   // 2136
  // ===============                                                                                                   // 2137
                                                                                                                       // 2138
  $.fn.tab.noConflict = function () {                                                                                  // 2139
    $.fn.tab = old                                                                                                     // 2140
    return this                                                                                                        // 2141
  }                                                                                                                    // 2142
                                                                                                                       // 2143
                                                                                                                       // 2144
  // TAB DATA-API                                                                                                      // 2145
  // ============                                                                                                      // 2146
                                                                                                                       // 2147
  var clickHandler = function (e) {                                                                                    // 2148
    e.preventDefault()                                                                                                 // 2149
    Plugin.call($(this), 'show')                                                                                       // 2150
  }                                                                                                                    // 2151
                                                                                                                       // 2152
  $(document)                                                                                                          // 2153
    .on('click.bs.tab.data-api', '[data-toggle="tab"]', clickHandler)                                                  // 2154
    .on('click.bs.tab.data-api', '[data-toggle="pill"]', clickHandler)                                                 // 2155
                                                                                                                       // 2156
}(jQuery);                                                                                                             // 2157
                                                                                                                       // 2158
/* ========================================================================                                            // 2159
 * Bootstrap: affix.js v3.3.1                                                                                          // 2160
 * http://getbootstrap.com/javascript/#affix                                                                           // 2161
 * ========================================================================                                            // 2162
 * Copyright 2011-2014 Twitter, Inc.                                                                                   // 2163
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)                                          // 2164
 * ======================================================================== */                                         // 2165
                                                                                                                       // 2166
                                                                                                                       // 2167
+function ($) {                                                                                                        // 2168
  'use strict';                                                                                                        // 2169
                                                                                                                       // 2170
  // AFFIX CLASS DEFINITION                                                                                            // 2171
  // ======================                                                                                            // 2172
                                                                                                                       // 2173
  var Affix = function (element, options) {                                                                            // 2174
    this.options = $.extend({}, Affix.DEFAULTS, options)                                                               // 2175
                                                                                                                       // 2176
    this.$target = $(this.options.target)                                                                              // 2177
      .on('scroll.bs.affix.data-api', $.proxy(this.checkPosition, this))                                               // 2178
      .on('click.bs.affix.data-api',  $.proxy(this.checkPositionWithEventLoop, this))                                  // 2179
                                                                                                                       // 2180
    this.$element     = $(element)                                                                                     // 2181
    this.affixed      =                                                                                                // 2182
    this.unpin        =                                                                                                // 2183
    this.pinnedOffset = null                                                                                           // 2184
                                                                                                                       // 2185
    this.checkPosition()                                                                                               // 2186
  }                                                                                                                    // 2187
                                                                                                                       // 2188
  Affix.VERSION  = '3.3.1'                                                                                             // 2189
                                                                                                                       // 2190
  Affix.RESET    = 'affix affix-top affix-bottom'                                                                      // 2191
                                                                                                                       // 2192
  Affix.DEFAULTS = {                                                                                                   // 2193
    offset: 0,                                                                                                         // 2194
    target: window                                                                                                     // 2195
  }                                                                                                                    // 2196
                                                                                                                       // 2197
  Affix.prototype.getState = function (scrollHeight, height, offsetTop, offsetBottom) {                                // 2198
    var scrollTop    = this.$target.scrollTop()                                                                        // 2199
    var position     = this.$element.offset()                                                                          // 2200
    var targetHeight = this.$target.height()                                                                           // 2201
                                                                                                                       // 2202
    if (offsetTop != null && this.affixed == 'top') return scrollTop < offsetTop ? 'top' : false                       // 2203
                                                                                                                       // 2204
    if (this.affixed == 'bottom') {                                                                                    // 2205
      if (offsetTop != null) return (scrollTop + this.unpin <= position.top) ? false : 'bottom'                        // 2206
      return (scrollTop + targetHeight <= scrollHeight - offsetBottom) ? false : 'bottom'                              // 2207
    }                                                                                                                  // 2208
                                                                                                                       // 2209
    var initializing   = this.affixed == null                                                                          // 2210
    var colliderTop    = initializing ? scrollTop : position.top                                                       // 2211
    var colliderHeight = initializing ? targetHeight : height                                                          // 2212
                                                                                                                       // 2213
    if (offsetTop != null && colliderTop <= offsetTop) return 'top'                                                    // 2214
    if (offsetBottom != null && (colliderTop + colliderHeight >= scrollHeight - offsetBottom)) return 'bottom'         // 2215
                                                                                                                       // 2216
    return false                                                                                                       // 2217
  }                                                                                                                    // 2218
                                                                                                                       // 2219
  Affix.prototype.getPinnedOffset = function () {                                                                      // 2220
    if (this.pinnedOffset) return this.pinnedOffset                                                                    // 2221
    this.$element.removeClass(Affix.RESET).addClass('affix')                                                           // 2222
    var scrollTop = this.$target.scrollTop()                                                                           // 2223
    var position  = this.$element.offset()                                                                             // 2224
    return (this.pinnedOffset = position.top - scrollTop)                                                              // 2225
  }                                                                                                                    // 2226
                                                                                                                       // 2227
  Affix.prototype.checkPositionWithEventLoop = function () {                                                           // 2228
    setTimeout($.proxy(this.checkPosition, this), 1)                                                                   // 2229
  }                                                                                                                    // 2230
                                                                                                                       // 2231
  Affix.prototype.checkPosition = function () {                                                                        // 2232
    if (!this.$element.is(':visible')) return                                                                          // 2233
                                                                                                                       // 2234
    var height       = this.$element.height()                                                                          // 2235
    var offset       = this.options.offset                                                                             // 2236
    var offsetTop    = offset.top                                                                                      // 2237
    var offsetBottom = offset.bottom                                                                                   // 2238
    var scrollHeight = $('body').height()                                                                              // 2239
                                                                                                                       // 2240
    if (typeof offset != 'object')         offsetBottom = offsetTop = offset                                           // 2241
    if (typeof offsetTop == 'function')    offsetTop    = offset.top(this.$element)                                    // 2242
    if (typeof offsetBottom == 'function') offsetBottom = offset.bottom(this.$element)                                 // 2243
                                                                                                                       // 2244
    var affix = this.getState(scrollHeight, height, offsetTop, offsetBottom)                                           // 2245
                                                                                                                       // 2246
    if (this.affixed != affix) {                                                                                       // 2247
      if (this.unpin != null) this.$element.css('top', '')                                                             // 2248
                                                                                                                       // 2249
      var affixType = 'affix' + (affix ? '-' + affix : '')                                                             // 2250
      var e         = $.Event(affixType + '.bs.affix')                                                                 // 2251
                                                                                                                       // 2252
      this.$element.trigger(e)                                                                                         // 2253
                                                                                                                       // 2254
      if (e.isDefaultPrevented()) return                                                                               // 2255
                                                                                                                       // 2256
      this.affixed = affix                                                                                             // 2257
      this.unpin = affix == 'bottom' ? this.getPinnedOffset() : null                                                   // 2258
                                                                                                                       // 2259
      this.$element                                                                                                    // 2260
        .removeClass(Affix.RESET)                                                                                      // 2261
        .addClass(affixType)                                                                                           // 2262
        .trigger(affixType.replace('affix', 'affixed') + '.bs.affix')                                                  // 2263
    }                                                                                                                  // 2264
                                                                                                                       // 2265
    if (affix == 'bottom') {                                                                                           // 2266
      this.$element.offset({                                                                                           // 2267
        top: scrollHeight - height - offsetBottom                                                                      // 2268
      })                                                                                                               // 2269
    }                                                                                                                  // 2270
  }                                                                                                                    // 2271
                                                                                                                       // 2272
                                                                                                                       // 2273
  // AFFIX PLUGIN DEFINITION                                                                                           // 2274
  // =======================                                                                                           // 2275
                                                                                                                       // 2276
  function Plugin(option) {                                                                                            // 2277
    return this.each(function () {                                                                                     // 2278
      var $this   = $(this)                                                                                            // 2279
      var data    = $this.data('bs.affix')                                                                             // 2280
      var options = typeof option == 'object' && option                                                                // 2281
                                                                                                                       // 2282
      if (!data) $this.data('bs.affix', (data = new Affix(this, options)))                                             // 2283
      if (typeof option == 'string') data[option]()                                                                    // 2284
    })                                                                                                                 // 2285
  }                                                                                                                    // 2286
                                                                                                                       // 2287
  var old = $.fn.affix                                                                                                 // 2288
                                                                                                                       // 2289
  $.fn.affix             = Plugin                                                                                      // 2290
  $.fn.affix.Constructor = Affix                                                                                       // 2291
                                                                                                                       // 2292
                                                                                                                       // 2293
  // AFFIX NO CONFLICT                                                                                                 // 2294
  // =================                                                                                                 // 2295
                                                                                                                       // 2296
  $.fn.affix.noConflict = function () {                                                                                // 2297
    $.fn.affix = old                                                                                                   // 2298
    return this                                                                                                        // 2299
  }                                                                                                                    // 2300
                                                                                                                       // 2301
                                                                                                                       // 2302
  // AFFIX DATA-API                                                                                                    // 2303
  // ==============                                                                                                    // 2304
                                                                                                                       // 2305
  $(window).on('load', function () {                                                                                   // 2306
    $('[data-spy="affix"]').each(function () {                                                                         // 2307
      var $spy = $(this)                                                                                               // 2308
      var data = $spy.data()                                                                                           // 2309
                                                                                                                       // 2310
      data.offset = data.offset || {}                                                                                  // 2311
                                                                                                                       // 2312
      if (data.offsetBottom != null) data.offset.bottom = data.offsetBottom                                            // 2313
      if (data.offsetTop    != null) data.offset.top    = data.offsetTop                                               // 2314
                                                                                                                       // 2315
      Plugin.call($spy, data)                                                                                          // 2316
    })                                                                                                                 // 2317
  })                                                                                                                   // 2318
                                                                                                                       // 2319
}(jQuery);                                                                                                             // 2320
                                                                                                                       // 2321
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);
