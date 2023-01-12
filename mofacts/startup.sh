#!/bin/bash
# Bash Script to display a menu controlling the meteor app Mofacts


# Define variables
METEOR_DIR="$HOME/mofacts/mofacts"

# Define functions
function start_meteor (){
  cd "$METEOR_DIR"
  bash run_meteor
}


function exit_to_shell {
  exit
}

function stop_mofacts
{
  #shutdown the system
  sudo shutdown -h now
}

function display_menu {
  clear
  echo "Welcome to the Mofacts Meteor App"
  echo "---------------------------------"
  echo "1. Start Meteor"
  echo "2. Exit to shell"
  echo "3. Shutdown"
  echo "---------------------------------"
  echo "Please enter your choice [1-3] (Default 1 will start in 10s):"
}

# start the script
# set 10 second timeout
TIMER=10
while true
do
  display_menu
  read -t $TIMER -n 1 SELECTION
  #display a timeout warning
  if [ -z "$SELECTION" ]
  then
    echo "No selection made, starting Mofacts"
    start_meteor
  fi
  case $SELECTION in
    1) start_meteor ;;
    2) exit_to_shell ;;
    3) stop_mofacts ;;
    *) echo "Invalid selection, exiting to shell" && exit_to_shell ;;
  esac
done