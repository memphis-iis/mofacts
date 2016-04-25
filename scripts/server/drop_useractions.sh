#!/bin/bash

#One failure quits everything
set -e

#The DB we target
export MONGO_DB='MoFaCT'


read -n1 -r -p "Press y to drop $MONGO_DB UserTimesLog" key

if [ "$key" = 'y' ]; then
    echo ""
    echo "Dropping $MONGO_DB"
    mongo $MONGO_DB --eval "db.userTimesLog.drop()"
else
    echo ""
    echo "SKIPPED"
fi

