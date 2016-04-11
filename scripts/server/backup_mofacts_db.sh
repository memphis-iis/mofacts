#!/bin/bash

#One failure quits everything
set -e

#The DB we target
export MONGO_DB='MoFaCT'

mongodump --db $MONGO_DB
