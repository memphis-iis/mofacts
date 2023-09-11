#! /bin/sh
mongo MoFaCT --eval "db.dropDatabase()"
mongorestore ./home/rusty/mongodump-2023-09-11
