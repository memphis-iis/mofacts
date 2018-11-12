Router.route('/login',function(){
  serverConsole("login route");
  this.response.setHeader( 'Access-Control-Allow-Origin', '*' );

  if ( this.request.method === "OPTIONS" ) {
    this.response.setHeader( 'Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept' );
    this.response.setHeader( 'Access-Control-Allow-Methods', 'POST, PUT, GET, DELETE, OPTIONS' );
    this.response.end( 'Set OPTIONS.' );
  } else {
    API.handleRequest( this, 'login', this.request.method );
  }
}, { where: 'server'});

Router.route('/translate',function(){
  serverConsole("translate route");
  this.response.setHeader( 'Access-Control-Allow-Origin', '*' );

  if ( this.request.method === "OPTIONS" ) {
    this.response.setHeader( 'Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept' );
    this.response.setHeader( 'Access-Control-Allow-Methods', 'POST, PUT, GET, DELETE, OPTIONS' );
    this.response.end( 'Set OPTIONS.' );
  } else {
    API.handleRequest( this, 'translate', this.request.method );
  }
}, { where: 'server'});

API = {
  login: function(context, username, password){
    var user = Meteor.users.findOne({"username":username});
    if(user){
      var correctPassword = Accounts._checkPassword(user,password);
      if(!!correctPassword.error){
        console.log("incorrect password!");
        var response = {"error":"Incorrect password"};
        API.utility.response(context,401,response);
      }else{
        console.log("Correct password!");
        var curUser = correctPassword.userId;
        var tokenID = Random.hexString( 32 );
        var expires = new Date();
        var oneWeek = 7 * 24 * 60 * 60 * 1000;
        expires.setTime(expires.getTime() + oneWeek);
        expires = expires.getTime() / 1000;
        var authToken = {"tokenID":tokenID,"expires":expires};
        console.log("authToken1: " + JSON.stringify(authToken));
        Meteor.users.update({_id:curUser}, {$set: {"authToken":authToken}});
        console.log("curUser: " + curUser);
        var tdfs = Tdfs.find({"owner":curUser}).fetch();//
        console.log("tdfs: " + JSON.stringify(tdfs[0]));
        var tdfFileNames = [];
        for(var index in tdfs){
          var tdf = tdfs[index];
          var targetLang = tdf.targetLang || "en";
          if(!!tdf.fileName){
            tdfFileNames.push({"TDFName":tdf.fileName,"TDFTargetLang":targetLang});
          }
        }
        response = {
          "authToken":authToken,
          "tdfs":tdfFileNames
        }
        API.utility.response(context,200,response);
      }
    }
  },
  handleRequest: function( context, resource, method ) {
    if(resource==="login"){
      var getRequestContents = API.utility.getRequestContents(context.request);
      API.login(context,getRequestContents.username,getRequestContents.password);
    }else{
      var connection = API.connection( context.request );
      if ( !connection.error ) {
        API.methods[ resource ][ method ]( context, connection );
      } else {
        API.utility.response( context, 401, connection );
      }
    }
  },
  connection: function( request ) {
    var getRequestContents = API.utility.getRequestContents( request ),
        authToken             = getRequestContents.authToken,
        validUser          = API.authentication( authToken );

    if ( validUser ) {
      delete getRequestContents.authToken;
      return { owner: validUser, data: getRequestContents };
    } else {
      return { error: 401, message: "Invalid auth token." };
    }
  },
  utility: {
    getRequestContents: function( request ) {
      switch( request.method ) {
        case "GET":
          return request.query;
        case "POST":
        case "PUT":
        case "DELETE":
          return request.body;
      }
    },
    response: function( context, statusCode, data ) {
      context.response.setHeader( 'Content-Type', 'application/json' );
      context.response.statusCode = statusCode;
      context.response.end( JSON.stringify( data ) );
    }
  },
  authentication: function( authToken ) {
    var curDateTime = new Date();
    curDateTime = curDateTime.getTime() / 1000;
    var getUser = Meteor.users.findOne({"authToken.tokenID":authToken,"authToken.expires":{"$gt": curDateTime}});
    if ( getUser ) {
      console.log("getUser:" + JSON.stringify(getUser));
      return getUser._id;
    } else {
      return false;
    }
  },
  methods:{
    translate: {
      POST: function(context, connection){
        console.log("connection.data:" + JSON.stringify(connection.data));
        //var translateURL = "https://translate.google.com/#auto/" + targetlang + "/" + wordToTranslate;
        API.utility.response(context,200,listOfTDFS);
      }
    }
  }
}
