#!/bin/bash

################################################################
# Configuration

#variables used in this script
BUNDLE_NAME=mofacts.tar.gz
BUNDLE_POSTDEP=$BUNDLE_NAME.deployed
EXEC_USER=www-data

#parameters for meteor
export MONGO_URL='mongodb://localhost:27017/MoFaCT'
export ROOT_URL='http://optimallearning.org'
export BIND_IP='0.0.0.0'
export PORT='3000'

################################################################
# Initial checks

#Must be root or able to sudo as root
if [ "$(id -u)" != "0" ]; then
    echo "Not running as root - will test..."
    if [ "$(sudo id -u)" != "0" ]; then
        echo "You must be able to run sudo to run this script"
        exit 1
    fi
fi

################################################################
# Implementation as functions

#FUNCTION: Force shutdown of all nodejs processes
function force_shutdown() {
    echo "Killing nodejs processes"
    sudo killall nodejs
}

#FUNCTION: Deployment functionality
function deploy() {
    echo "Deleting previous bundle"
    sudo rm -fr bundle
    sudo -E rm -f $BUNDLE_POSTDEP

    echo "Expanding bundle " $BUNDLE_NAME
    sudo -E -u $EXEC_USER tar -zxf $BUNDLE_NAME

    echo "Renaming to " $BUNDLE_POSTDEP
    sudo mv $BUNDLE_NAME $BUNDLE_POSTDEP

    echo "Rebuilding fibers in bundle/programs/server/node_modules"
    sudo rm -fr bundle/programs/server/node_modules/fibers
    sudo npm install fibers@1.0.1

    echo "Insuring ownership of all files"
    sudo chown -R $EXEC_USER:$EXEC_USER *
}

#FUNCTION: Execution functionality
function execute() {
    #Run as www-data
    echo "NOTE: will execute as user " $EXEC_USER

    #We run as the EXEC_USER but maintain the current environment,
    #So we also need to reset anything needed by that user
    export HOME=$(pwd)

    sudo -E -u $EXEC_USER forever start bundle/main.js
}

################################################################
# LOGIC

force_shutdown
if [ -f $BUNDLE_NAME ]; then
    deploy
fi
execute
