#! /bin/bash
mongo MoFaCT --eval "db.dropDatabase()"

#restore the dump from ./mongodump/
mongorestore --db MoFaCT mongodump/MoFaCT
