#!/bin/bash

#One failure quits everything
set -e

#The DB we target
export MONGO_DB='MoFaCT'

mongo $MONGO_DB --eval "db.tdfs.find({}, {fileName:1}).forEach(function(o){print(o.fileName)})"
