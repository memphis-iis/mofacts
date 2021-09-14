#!/bin/bash

sudo -u mofacts psql -c "DROP TABLE IF EXISTS componentstate, globalexperimentstate, history;"

#Note we're discarding all error messages here.  If an issue arises, disable this.
sudo -u mofacts psql -f initTables.sql 2>/dev/null