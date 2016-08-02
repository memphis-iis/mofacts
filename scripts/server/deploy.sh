#!/bin/bash

################################################################
# Configuration

# variables used in this script
BUNDLE_NAME=mofacts.tar.gz
BUNDLE_POSTDEP=$BUNDLE_NAME.deployed
EXEC_USER=www-data

# parameters for meteor
# IMPORTANT - we will set other env vars in the execute function below
export MONGO_URL='mongodb://localhost:27017/MoFaCT'
# export ROOT_URL='http://mofacts.optimallearning.org'
export ROOT_URL='http://ec2-52-34-171-189.us-west-2.compute.amazonaws.com'
export BIND_IP='127.0.0.1'
export PORT='3000'

################################################################
# Initial checks

# Must be root or able to sudo as root
if [ "$(id -u)" != "0" ]; then
    echo "Not running as root - will test..."
    if [ "$(sudo id -u)" != "0" ]; then
        echo "You must be able to run sudo to run this script"
        exit 1
    fi
fi

################################################################
# Implementation as functions

# FUNCTION: Force shutdown of all nodejs processes
function force_shutdown() {
    echo "Killing node processes"
    sudo killall node
}

# FUNCTION: Deployment functionality
function deploy() {
    echo "Deleting previous bundle"
    sudo rm -fr bundle
    sudo -E rm -f $BUNDLE_POSTDEP

    echo "Expanding bundle " $BUNDLE_NAME
    sudo -E -u $EXEC_USER tar -zxf $BUNDLE_NAME

    echo "Renaming to " $BUNDLE_POSTDEP
    sudo mv $BUNDLE_NAME $BUNDLE_POSTDEP

    echo "Rebuilding bundle/programs/server"
    pushd bundle/programs/server
    sudo npm install
    sudo npm install bcrypt
    popd

    echo "Insuring ownership of all files"
    sudo chown -R $EXEC_USER:$EXEC_USER *
}

# FUNCTION: Execution functionality
function execute() {
    #Run as www-data
    echo "IMPORTANT: will execute as user " $EXEC_USER

    #We run as the EXEC_USER but maintain the current environment,
    #So we also need to reset anything needed by that user
    export HOME=$(pwd)

    # The settings file MUST exist - and then we put the contents in the
    # environment variable required by Meteor
    export SETTINGS_FILE=$HOME/settings.json
    if [ ! -f $SETTINGS_FILE ]; then
        echo "Could not find $SETTINGS_FILE"
        echo "Execution can NOT continue"
        exit 2
    fi

    export METEOR_SETTINGS=$(cat $SETTINGS_FILE)
    sudo -E -u $EXEC_USER forever start bundle/main.js
}

################################################################
# LOGIC

force_shutdown
if [ -f $BUNDLE_NAME ]; then
    deploy
fi
execute
