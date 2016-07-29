#!/usr/bin/env python

"""Extract user data from Mofacts MongoDB."""

import sys

try:
    import pymongo
except ImportError:
    print("This script requires pymongo")
    sys.exit(1)

MONGO_URL = "mongodb://localhost:27017/MoFaCT"
MONGO_USERS = "users"
MONGO_COLL = "userTimesLog"


def log(s, *args):
    """Output to stderr."""
    if args:
        s = s % args
    sys.stderr.write(s)
    sys.stderr.write('\n')
    sys.stderr.flush()


def usage():
    """Print out command line usage."""
    log("""extract_user_exp.py
    Extract the user times log for one user in one experiment

    ./extract_user_exp.py user experiment
    where:
        - user = the user ID (the MongoDB ID will be looked up)
        - experiment = TDF file name or '-list' to see all experiments for user
    """)
    return 1


def broken(msg):
    """Helper: print out error msg and return process exit code."""
    log("Can not continue")
    log(msg)
    return 2


def main():
    """Actual entry point."""
    args = sys.argv[1:]
    if len(args) != 2:
        return usage()

    user_name, experiment = [i.strip() for i in args if i.strip()]
    if not user_name or not experiment:
        return usage()

    experiment = experiment.replace('.', '_')
    show_list = (experiment == "-list")

    log("About to extract user experiment data...")
    log(" MongoDB URL: %s", MONGO_URL)
    log(" User Coll:   %s", MONGO_USERS)
    log(" Collection:  %s", MONGO_COLL)
    log(" User Name:   %s", user_name)
    log(" Experiment:  %s", ("<list>" if show_list else experiment))

    # Open MongoDB
    client = pymongo.MongoClient(MONGO_URL)
    db = client.get_default_database()

    user_doc = db[MONGO_USERS].find_one({'username': user_name})
    if not user_doc:
        return broken("Could not find that user")

    user_id = user_doc["_id"]
    log("%s has _id %s", user_name, user_id)

    user_times = db[MONGO_COLL].find_one({'_id': user_id})
    if not user_times:
        return broken("No logged data for that user")

    if show_list:
        exp_list = list(sorted(
            (k, len(v)) for k, v in user_times.items() if v and type(v) is list
        ))
        log("Found %d experiments for user %s", len(exp_list), user_name)
        for e, ln in exp_list:
            log("  %8d recs: %s", ln, e)
    else:
        user_log = user_times.get(experiment, [])
        if not user_log:
            log("No experimental data for that user in user times log")

        excludes = set(["action", "_id"])
        col_names = ["action"] + sorted(set([
            cn
            for log_rec in user_log
            for cn in log_rec.keys()
            if cn not in excludes
        ]))

        log("Found %d columns and %d rows", len(col_names), len(user_log))

        def fld(val):
            """Correctly format a field value for our output."""
            val = str(val).strip()
            for f, r in [('\t', '\\t'), ('\r', '\\r'), ('\n', '\\n')]:
                val = val.replace(f, r)
            return val

        print('\t'.join(col_names))
        for log_rec in user_log:
            print('\t'.join(fld(log_rec.get(cn, "")) for cn in col_names))

if __name__ == "__main__":
    main()
