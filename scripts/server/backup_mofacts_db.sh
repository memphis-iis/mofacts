#!/bin/bash

#One failure quits everything
set -e

# The DB we target
export MONGO_DB='MoFaCT'
# Date modifer we add to the script file
DATE=`date +%Y-%m-%d`

mongodump --db $MONGO_DB
tar -zcf dump.$DATE.tar.gz dump/
