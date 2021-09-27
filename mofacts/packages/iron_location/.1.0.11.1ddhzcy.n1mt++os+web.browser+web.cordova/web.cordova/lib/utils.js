var Url = Iron.Url;
var HASH_PARAM_NAME='__hash__';

/**
 * Given:
 *   http://host:port/some/pathname/?query=string#bar
 *
 * Return:
 *   http://host:port#!some/pathname/?query=string&__hash__=bar
 */
urlToHashStyle = function (url) {
  var parts = Url.parse(url);
  var hash = parts.hash && parts.hash.replace('#', '');
  var search = parts.search;
  var pathname = parts.pathname;
  var root = parts.rootUrl; 

  // do we have another hash value that isn't a path?
  if (hash && hash.charAt(0) !== '!') {
    var hashQueryString = HASH_PARAM_NAME + '=' + hash;
    search = search ? (search + '&') : '?';
    search += hashQueryString;
    hash = '';
  }

  // if we don't already have a path on the hash create one
  if (! hash && pathname) {
    hash = '#!' + pathname.substring(1);
  } else if (hash) {
    hash = '#' + hash;
  }

  return [
    root,
    hash,
    search
  ].join('');
};

/**
 * Given a url that uses the hash style (see above), return a new url that uses
 * the hash path as a normal pathname.
 *
 * Given:
 *   http://host:port#!some/pathname/?query=string&__hash__=bar
 * 
 * Return:
 *   http://host:port/some/pathname/?query=string#bar
 */
urlFromHashStyle = function (url) {
  var parts = Url.parse(url);
  var pathname = parts.hash && parts.hash.replace('#!', '/');
  var search = parts.search;
  var root = parts.rootUrl;
  var hash;

  // see if there's a __hash__=value in the query string in which case put it 
  // back in the normal hash position and delete it from the search string.
  if (_.has(parts.queryObject, HASH_PARAM_NAME)) {
    hash = '#' + parts.queryObject[HASH_PARAM_NAME];
    delete parts.queryObject[HASH_PARAM_NAME];
  } else {
    hash = '';
  }

  return [
    root,
    pathname,
    Url.toQueryString(parts.queryObject),
    hash
  ].join('');
};

/**
 * Fix up a pathname intended for use with a hash path by moving any hash
 * fragments into the query string.
 */
fixHashPath = function (pathname) {
  var parts = Url.parse(pathname);
  var query = parts.queryObject;
  
  // if there's a hash in the path move that to the query string
  if (parts.hash) {
    query[HASH_PARAM_NAME] = parts.hash.replace('#', '')
  }

  return [
    '!',
    parts.pathname.substring(1),
    Url.toQueryString(query)
  ].join('');
};
