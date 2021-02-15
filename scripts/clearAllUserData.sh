#!/bin/bash

echo "Dropping userTimesLog"
vagrant ssh -c 'mongo MoFaCT --eval "db.userTimesLog.drop();db.userMetrics.drop();db.stimuli_syllables.drop()"'
echo "Done"
