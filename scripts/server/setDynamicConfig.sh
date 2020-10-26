#!/bin/bash

#Note, scripts don't update automatically from the host OS filesystem to vagrant's so editing this script must be done in vagrant

export MONGO_DB='MoFaCT'
mongo $MONGO_DB --eval "db.dynamicConfig.update({},{ isSystemDown: false, serverLoadConstants: { loginsWithinAHalfHourLimit: 10, utlQueriesWithinFifteenMinLimit:12 } }, {upsert: true})"
