FROM ubuntu:trusty

# Install dependencies
RUN apt-get update && \
    apt-get install --assume-yes build-essential bzip2 curl git python

# Install Meteor
RUN curl https://install.meteor.com/?release=1.6.1.1 --output /tmp/install-meteor.sh && \
    printf "\n[-] Installing Meteor... \n\n" && \
    sh /tmp/install-meteor.sh

# Add mofacts resources
ADD mofacts /mofacts

# Add build script
ADD mofacts-docker-build.sh /tmp/mofacts-docker-build.sh

# Build mofacts
# RUN cd /mofacts && \
#     meteor build --allow-superuser ./build --architecture os.linux.x86_64
ENTRYPOINT ["sh", "/tmp/mofacts-docker-build.sh"]
