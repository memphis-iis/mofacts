#! /bin/sh
mongo MoFaCT --eval "db.dropDatabase()"
mongorestore mongodump/