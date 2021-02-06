#!/bin/bash

sudo -u mofacts psql -c "DROP TABLE IF EXISTS componentstate,globalexperimentstate,history,item,itemsourcesentences,section_user_map,section,course,tdf,assignment CASCADE;"
sudo -u mofacts psql -c "DROP TYPE tdfVisibility, responseType, outcomeType, componentStateType, unitType CASCADE;"
# sudo -u mofacts psql -c "drop table globalexperimentstate;"
# sudo -u mofacts psql -c "drop table history; drop table item;"
# sudo -u mofacts psql -c "drop table itemsourcesentences;"
# sudo -u mofacts psql -c "drop table section_user_map;"
# sudo -u mofacts psql -c "drop table section;"
# sudo -u mofacts psql -c "drop table course;"
# sudo -u mofacts psql -c "drop table tdf;"
# sudo -u mofacts psql -c "drop table assignment;"
# sudo -u mofacts psql -c "drop type tdfVisibility;"
# sudo -u mofacts psql -c "drop type responseType;"
# sudo -u mofacts psql -c "drop type outcomeType;"
# sudo -u mofacts psql -c "drop type componentStateType;"
# sudo -u mofacts psql -c "drop type unitType;"
sudo -u mofacts psql -f initTables.sql