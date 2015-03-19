#!/bin/bash

THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SCRIPT=$THIS_DIR/../mofacts/server/experiment_times.js

#mongo --quiet local --eval "experiment='SDTrainTest.xml'" $SCRIPT
#mongo --quiet local --eval "experiment='Music2.xml'" $SCRIPT
mongo --quiet MoFaCT --eval "experiment='Music2.xml'" $SCRIPT
