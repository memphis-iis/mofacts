#!/bin/bash

################################################################
# Configuration

#variables used in this script
EXEC_USER=www-data

#parameters for meteor
export MONGO_URL='mongodb://localhost:27017/MoFaCT'
export ROOT_URL='http://mofacts.optimallearning.org'
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
    echo "Killing node processes"
    sudo killall node
}

#FUNCTION: Execution functionality
function execute() {
    #Run as www-data
    echo "IMPORTANT: will execute as user " $EXEC_USER

    #We run as the EXEC_USER but maintain the current environment,
    #So we also need to reset anything needed by that user
    export HOME=$(pwd)

    sudo -E -u $EXEC_USER node bundle/main.js
}

################################################################
# LOGIC

force_shutdown
execute
