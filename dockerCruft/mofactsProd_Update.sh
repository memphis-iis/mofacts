#!/bin/bash

function checkWhichServiceRunning {
  $(docker-compose exec prod-app_1_a "pwd")
  oneA=$?;
  $(docker-compose exec prod-app_1_b "pwd")
  oneB=$?;

  $(docker-compose exec prod-app_2_a "pwd")
  twoA=$?;
  $(docker-compose exec prod-app_2_b "pwd")
  twoB=$?;

  if [ $oneA -eq 0 ] || [ $oneB -eq 0]; then
    echo "one";
    curService="one";
  elif [ $twoA -eq 0 ] || [ $twoB -eq 0 ]; then
    curService="two";
  else
    curService="none";
  fi
}

