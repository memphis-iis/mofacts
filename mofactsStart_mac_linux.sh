#!/bin/bash

function createVM {
 echo "Creating Docker VM";
 docker-machine create --driver virtualbox --virtualbox-memory 4096 --virtualbox-share-folder "$mofactsDirectory:mofacts" default;
 echo "Docker VM created";
}

function startVM {
 echo "Starting Docker VM";
 docker-machine start;
 echo "Docker VM started";
}

function forwardPort {
 echo "Fowarding port 3000";
 portRuleExists=`VBoxManage showvminfo default | grep "tcp-port3000"`;
 if [ -z "$portRuleExists" ]; then
  VBoxManage controlvm "default" natpf1 "tcp-port3000,tcp,0.0.0.0,3000,,3000";
 fi
}

function mountHostFiles {
 echo "Mounting mofacts files";
 docker-machine ssh default "mkdir -p /home/docker/mofacts; sudo mount -t vboxsf mofacts /home/docker/mofacts;";
}

function runMofacts {
 echo "Starting up mofacts";
 if [ "$targetService" == "dev-app" ] || [ "$targetService" == "prod-app" ]; then
  export METEOR_SETTINGS=$(cat mofacts/settings.json);
 fi

 docker-compose up "$targetService" -d;
}

case "$1" in
 "--dev" )
  targetService="dev-app";
  echo "Development environment, running mofacts directly on host docker with meteor";
 ;;
 "--prod" )
  targetService="prod-app";
  echo "Prod environment, running mofacts with node docker";
 ;;
 * )
  #Only work in docker-machine vm if we're test users and not developers (who presumably run linux with docker installed already)
  targetService="test-app";
  
  mofactsDirectory=`pwd`;
  machineStatus=`docker-machine status 2>&1`;
  
  case "$machineStatus" in  
   *"command not found"* ) echo "docker-machine command not found, did you install Docker Toolbox?"; exit; ;;
   Error* ) echo "Docker VM not set up yet"; createVM; ;;
   *Stopped* ) echo "Docker VM stopped"; startVM; ;;
   * ) echo "Docker VM created and running";;
  esac
  
  mountHostFiles;
  
  forwardPort;

  #Set env vars so that docker-compose command redirects to docker-machine VM
  eval $(docker-machine env default)
  echo "Test environment, running mofacts with docker-machine";
  ;;
esac

runMofacts;
