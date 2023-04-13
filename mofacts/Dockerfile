FROM python:3.8-slim-buster

# Install system dependencies
RUN apt-get update && \
    apt-get install -y curl

# Install SpacyAPI
RUN curl https://raw.githubusercontent.com/aolney/SpacyAPI/master/docker/Dockerfile | docker build -

# Install AllenNLP Demo
RUN docker pull allennlp/demo

# Install Paraphrase Server
RUN docker pull aolney/paraphrase-server

# Install Illinois Wikifier Server
RUN docker pull aolney/illinois-wikifier-server

# Install Longform QA Service
RUN docker pull aolney/longform-qa-service

# Install Elasticsearch
RUN docker pull docker.elastic.co/elasticsearch/elasticsearch:7.14.1

# Use Node.js version 14
FROM node:14

# Set the working directory
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application code
COPY ../build /usr/src/app/build

# Copy dependencies
COPY ../mofacts_depends /mofacts_depends/

# Build the Meteor app
RUN npm run build

# Expose port 80
EXPOSE 80

# Start the app
CMD ["node", "main.js"]

# Expose ports for the containers
EXPOSE 5000 8000 8080 8090 5005 9200 80 4567

# Start the containers
CMD ["docker-compose", "up"]