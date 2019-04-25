#!/bin/bash

OUTPUTDIR=docker-out
CWD=`pwd`

if [[ ! -e $OUTPUTDIR ]]; then
    echo "Creating output directory for meteor bundle...";
    mkdir $OUTPUTDIR;
fi

# Build fresh docker image
docker build -t mofacts-build:dev -f mofacts/build/Dockerfile .

# Run image
docker run -v $CWD/$OUTPUTDIR:/artifacts mofacts-build:dev
