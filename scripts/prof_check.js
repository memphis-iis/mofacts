function pu(usr) {
    usr['services'] = usr['services'] || {};
    usr['services']['resume'] = 'ELIDED';
    print("  " + JSON.stringify(usr, null, 2));
}

db.users.find({'username':'ppavlik'}).forEach(function(usr){
    print('Found ' + usr._id + ' ' + usr.username);
    pu(usr);
});

print('');

db.userProfileData.find({'have_aws_id':true}).forEach(function(obj){
    print("HIT: " + obj._id);
    db.users.find({_id:obj._id}).forEach(function(usr){
        print("  " + usr.username);
        pu(usr);
    });
    print("");
});
