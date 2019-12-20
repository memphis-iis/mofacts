var res = db.users.insert({ 
    "_id" : "6diKya5fTBpgJngvA",
    "createdAt" : ISODate("2000-01-01T00:00:00.000Z"),
    "username" : "ADMIN", 
    "emails" : [ { "address" : "ADMIN", "verified" : false } ], 
    "profile" : { "experiment" : true } 
  });

printjson(res);