#!/bin/bash

mongo MoFaCT --eval "db.component_state.drop()";
mongo MoFaCT --eval "db.global_experiment_state.drop()";
mongo MoFaCT --eval "db.history.drop()";

mongo MoFaCT --eval "db.createCollection('component_state')";
mongo MoFaCT --eval "db.createCollection('global_experiment_state')";
mongo MoFaCT --eval "db.createCollection('history')";