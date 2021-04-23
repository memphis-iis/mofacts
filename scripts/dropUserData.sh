#!/bin/bash

#Note: This resets both Postgres and Mongo user data

echo "Dropping userTimesLog"
vagrant ssh -c 'mongo MoFaCT --eval "db.userTimesLog.drop();db.userMetrics.drop();db.stimuli_syllables.drop()"; cd mofacts/db; bash resetUserData.sh'
echo "Done"
