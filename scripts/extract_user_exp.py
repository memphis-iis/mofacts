#!/usr/bin/env python

import sys

try:
    import pymongo
except ImportError:
    print "This script requires pymongo"
    sys.exit(1)

import socket
HOSTNAME = socket.gethostname()

if HOSTNAME == 'fec239-1':
    print "Running on the Production Host"
    MONGO_URL = "mongodb://localhost:27017/MoFaCT"
else:
    print "Defaulting to development db (local)"
    MONGO_URL = "mongodb://localhost:27017/local"

MONGO_USERS = "users"
MONGO_COLL = "userTimesLog"

def usage():
    print """extract_user_exp.py
    Extract the user times log for one user in one experiment
    
    ./extract_user_exp.py user experiment
    where:
        - user = the user ID (the MongoDB ID will be looked up)
        - experiment = the TDF file name
    """
    return 1

def broken(msg):
    print "Can not continue"
    print msg
    return 2

def main():
    args = sys.argv[1:]
    if len(args) != 2:
        return usage()
    
    user_name, experiment = [i.strip() for i in args if i.strip()]
    if not user_name or not experiment:
        return usage()
    
    experiment = experiment.replace('.', '_')
    
    print "About to extract user experiment data..."
    print "  Host:        %s" % HOSTNAME
    print "  MongoDB URL: %s" % MONGO_URL
    print "  User Coll:   %s" % MONGO_USERS
    print "  Collection:  %s" % MONGO_COLL
    print "  User Name:   %s" % user_name
    print "  Experiment:  %s" % experiment
    
    #Open MongoDB
    client = pymongo.MongoClient(MONGO_URL)
    db = client.get_default_database()
    
    user_doc = db[MONGO_USERS].find_one({'username': user_name})
    if not user_doc:
        return broken("Could not find that user")
    
    user_id = user_doc["_id"]
    print "%s has _id %s" % (user_name, user_id)
    
    user_times = db[MONGO_COLL].find_one({'_id': user_id})
    if not user_times:
        return broken("No logged data for that user")
        
    user_log = user_times.get(experiment, [])
    if not user_log:
        print "No experimental data for that user in user times log"
        
    excludes = set(["action", "_id"])
    col_names = ["action"] + sorted(set([
        cn 
        for log_rec in user_log 
        for cn in log_rec.iterkeys() 
        if cn not in excludes
    ]))
    
    print "Found %d columns and %d rows" % (len(col_names), len(user_log))
    
    print ','.join(col_names)    
    for log_rec in user_log:
        print ','.join(str(log_rec.get(cn, "")) for cn in col_names)

if __name__ == "__main__":
    main()
