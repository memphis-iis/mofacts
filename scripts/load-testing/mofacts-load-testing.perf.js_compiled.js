const localMongo = new Mongo.Collection(null); // local-only - no database
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("@flood/element"));
	else if(typeof define === 'function' && define.amd)
		define(["@flood/element"], factory);
	else {
		var a = typeof exports === 'object' ? factory(require("@flood/element")) : factory(root["@flood/element"]);
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(this, function(__WEBPACK_EXTERNAL_MODULE__1__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "settings", function() { return settings; });
/* harmony import */ var _flood_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var _flood_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_flood_element__WEBPACK_IMPORTED_MODULE_0__);


const settings = {
	// userAgent: 'flood-chrome-test',
	// loopCount: 1,
	// Automatically wait for elements before trying to interact with them
	waitUntil: 'visible',
	stepDelay: 2.5
}

/* harmony default export */ __webpack_exports__["default"] = (() => {
	Object(_flood_element__WEBPACK_IMPORTED_MODULE_0__["step"])('Startup', async browser => {
		await browser.visit('https://staging.optimallearning.org/signinSouthwest?showTestLogins=true')
		await browser.wait(_flood_element__WEBPACK_IMPORTED_MODULE_0__["Until"].elementIsVisible(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].visibleText('pavlik@southwest.tn.edu')))
		await browser.click(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].visibleText('pavlik@southwest.tn.edu'))
		await browser.click(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].visibleText('BIOL 2010'))

		let randomUserName =
			Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
		await browser.type(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].css('#username'), randomUserName)

		await browser.click(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].visibleText('Sign In'))
		await browser.click(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].visibleText('Simple'))
		await browser.click(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].visibleText('Chapter 9 testerdoodle'))
		await browser.click(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].visibleText('Chapter 9 All Items'))
		await browser.click(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].visibleText('Continue'))
		await browser.click(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].css('#userAnswer'))
		await browser.type(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].css('#userAnswer'), 'yes')
		await browser.focus(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].css('#userAnswer'))

		let page = browser.page
		await page.keyboard.press('Enter')
	})

	_flood_element__WEBPACK_IMPORTED_MODULE_0__["step"].repeat(1000, 'Trials', async browser => {
		await browser.wait(_flood_element__WEBPACK_IMPORTED_MODULE_0__["Until"].elementIsVisible(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].css('#userAnswer')))
		let correctAnswer = await browser.evaluate(() => localMongo.findOne({}).currentAnswer)
		let rand = Math.floor(Math.random() * 11)
		let answer = rand >= 5 ? correctAnswer : 'an incorrect answer'
		await browser.type(_flood_element__WEBPACK_IMPORTED_MODULE_0__["By"].css('#userAnswer'), answer)

		let page = browser.page
		await page.keyboard.press('Enter')
	})
});


/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = __WEBPACK_EXTERNAL_MODULE__1__;

/***/ })
/******/ ]);
});