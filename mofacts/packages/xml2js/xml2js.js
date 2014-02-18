var Future = Npm.require("fibers/future");
var parseStringAsync = Npm.require("xml2js").parseString;

XML2JS = {
	parse: function (xml, options) {
		var future = new Future;
		var callback = future.resolver();
		parseStringAsync(xml, options || {}, callback);
		return future.wait();
	}
};