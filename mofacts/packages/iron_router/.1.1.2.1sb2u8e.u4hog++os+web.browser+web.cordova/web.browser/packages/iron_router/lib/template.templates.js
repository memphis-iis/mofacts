
Template.__checkName("__IronRouterNotFound__");
Template["__IronRouterNotFound__"] = new Template("Template.__IronRouterNotFound__", (function() {
  var view = this;
  return HTML.DIV({
    style: "width: 600px; margin: 0 auto; padding: 20px;"
  }, "\n    ", HTML.DIV({
    style: "font-size: 18pt; color: #999;"
  }, "\n      Oops, looks like there's no route on the client or the server for url: \"", Blaze.View("lookup:url", function() {
    return Spacebars.mustache(view.lookup("url"));
  }), '."\n    '), "\n  ");
}));

Template.__checkName("__IronRouterNoRoutes__");
Template["__IronRouterNoRoutes__"] = new Template("Template.__IronRouterNoRoutes__", (function() {
  var view = this;
  return HTML.Raw('<div style="font-family: helvetica; color: #777; max-width: 600px; margin: 20px auto;">\n      <h1 style="text-align: center; margin: 0; font-size: 48pt;">\n        iron:router\n      </h1>\n      <p style="text-align: center; font-size: 1.3em; color: red;">\n        No route definitions found.\n      </p>\n      <div style="margin: 50px 0px;">\n        <p>To create a route:</p>\n        <pre style="background: #f2f2f2; margin: 0; padding: 10px;">\nRouter.route(\'/\', function () {\n  this.render(\'Home\', {\n    data: function () { return Items.findOne({_id: this.params._id}); }\n  });\n});\n        </pre>\n        <p style="text-align:center"><small>To hide this page, set \'noRoutesTemplate\' in <a href="http://iron-meteor.github.io/iron-router/#global-default-options" target="_blank">Router.configure()</a></small></p>\n      </div>\n      <div style="margin: 50px 0px; text-align: center;">\n        Check it out on Github:<br>\n        <a href="https://github.com/iron-meteor/iron-router/" target="_blank">https://github.com/iron-meteor/iron-router/</a>\n        <br>\n        <br>\n        And check out the new Guide:<br>\n        <a href="https://iron-meteor.github.io/iron-router" target="_blank">\n          https://iron-meteor.github.io/iron-router\n        </a>\n      </div>\n    </div>');
}));
