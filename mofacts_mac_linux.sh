#!/bin/bash

function createVM {
 echo "Creating Docker VM";
 mofactsDirectory=`pwd`/mofacts;
 docker-machine create --driver virtualbox --virtualbox-memory 4096 --virtualbox-share-folder "$mofactsDirectory:mofacts" default;
 echo "Docker VM created";
}

function startVM {
 echo "Starting Docker VM";
 docker-machine start default;
 echo "Docker VM started";
}

function mountHostFiles {
 echo "Mounting mofacts files";
 docker-machine ssh default "mkdir -p /home/docker/mofacts; mkdir -p /home/docker/data; sudo mount -t vboxsf mofacts /home/docker/mofacts;";
}

function forwardPort {
 echo "Fowarding port 3000";
 portRuleExists=`VBoxManage showvminfo default | grep "tcp-port3000"`;
 if [ -z "$portRuleExists" ]; then
  VBoxManage controlvm "default" natpf1 "tcp-port3000,tcp,0.0.0.0,3000,,3000";
 fi
}

function setUpTestVM {
  machineStatus=`docker-machine status 2>&1`;
  
  case "$machineStatus" in  
   *"command not found"* ) echo "docker-machine command not found, did you install Docker Toolbox?"; exit; ;;
   Error* ) echo "Docker VM not set up yet"; createVM; ;;
   *Stopped* ) echo "Docker VM stopped"; startVM; ;;
   * ) echo "Docker VM created and running";;
  esac
  
  mountHostFiles;
  
  forwardPort;
}

function runMofacts {
 echo "Starting up mofacts";
 docker-compose up --build -d "$targetService" && docker-compose logs -f "$targetService";
}

origArgArray=$@;

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 [--dev|--prod1|--prod2] <up|down>";
  exit;
fi

case "$1" in
 "--dev" )
  targetService="dev-app"; shift;
  echo "Development environment, running mofacts directly on host docker with meteor";
 ;;
 "--prod1" )
  targetService="prod-app_1_a prod-app_1_b"; shift;
  echo "Prod environment 1, running mofacts with node docker";
 ;;
 "--prod2" )
  targetService="prod-app_2_a prod-app_2_b"; shift;
  echo "Prod environment 2, running mofacts with node docker";
  ;;
 * )
  #Only work in docker-machine vm if we're test users and not developers (who presumably run linux with docker installed already)
  targetService="test-app";
  echo "Test environment, running mofacts with docker-machine";
  ;;
esac

case "$1" in
 "up" )
    if [ "$targetService" == "test-app" ]; then
      setUpTestVM;
      #Set env vars so that docker-compose command redirects to docker-machine VM
      eval $(docker-machine env default); 
    else
      #If we're running dev or prod we need to pass in settings as an environment variable
      export METEOR_SETTINGS=$(cat mofacts/settings.json);
    fi
    
    runMofacts;
  ;;
 "down" )
    if [ "$targetService" == "test-app" ]; then
      #Set env vars so that docker-compose command redirects to docker-machine VM
      eval $(docker-machine env default);
    fi

    docker-compose stop;

    if [ "$targetService" == "test-app" ]; then
      docker-machine stop default;
    fi
  ;;
 * )
    echo "Please specify whether to bring up mofacts or shut it down, e.g. '$0 $origArgArray (up|down)'";
  ;;
esac

echo "Done";