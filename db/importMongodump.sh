#! /bin/bash
mongo MoFaCT --eval "db.dropDatabase()"
mongorestore ./mongodump/
