FROM node:12-alpine

#set enviorment variable for scripts folder
ENV SCRIPTS_FOLDER /scripts

#set enviorment variable for mofacts_config
ENV MOFACTS_CONFIG /mofacts_config

#copy in the scripts folder
COPY scripts $SCRIPTS_FOLDER

#install bash, openrc, util-linux, openjdk8, tar, gzip
RUN apk add --no-cache bash tar nodejs npm

#run the entrypoint script
ENTRYPOINT ["bash", "/scripts/entrypoint.sh"]

#expose the port
EXPOSE 80
EXPOSE 3000