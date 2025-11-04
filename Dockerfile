# The tag here should match the Meteor version of your app, per .meteor/release
FROM geoffreybooth/meteor-base:3.3.2

# Copy app package.json and package-lock.json into container
COPY ./mofacts/package*.json $APP_SOURCE_FOLDER/

# Copy settings.json into container
COPY ./mofacts/.deploy/assets/ /mofactsAssets/

#verify the presence of the settings.json file in the assets folder
RUN test -f /mofactsAssets/settings.json && echo "settings.json file found" || echo "settings.json file not found"

#set environment variable for meteor settings
ENV METEOR_SETTINGS_WORKAROUND /mofactsAssets/settings.json

RUN bash $SCRIPTS_FOLDER/build-app-npm-dependencies.sh

# Copy app source into container
COPY ./mofacts/ $APP_SOURCE_FOLDER/

# Clear Meteor build cache to ensure fresh compilation
RUN rm -rf $APP_SOURCE_FOLDER/.meteor/local

# Delete old package versions to allow Meteor 3.0 to resolve fresh versions
RUN rm -f $APP_SOURCE_FOLDER/.meteor/versions

# Build with --allow-incompatible-update for Meteor 3.0 upgrade
RUN cd $APP_SOURCE_FOLDER && \
    mkdir -p $APP_BUNDLE_FOLDER && \
    TOOL_NODE_FLAGS=--max-old-space-size=8000 meteor build --allow-incompatible-update --directory $APP_BUNDLE_FOLDER --server-only


# Use the specific version of Node expected by your Meteor release, per https://docs.meteor.com/changelog.html; this is expected for Meteor 3.3
FROM node:22-alpine

ENV APP_BUNDLE_FOLDER /opt/bundle
ENV SCRIPTS_FOLDER /docker

# Install OS build dependencies, which stay with this intermediate image but don’t become part of the final published image
RUN apk --no-cache add \
	bash \
	g++ \
	make \
	python3

# Copy in entrypoint
COPY --from=0 $SCRIPTS_FOLDER $SCRIPTS_FOLDER/

# Copy in app bundle
COPY --from=0 $APP_BUNDLE_FOLDER/bundle $APP_BUNDLE_FOLDER/bundle/

RUN bash $SCRIPTS_FOLDER/build-meteor-npm-dependencies.sh --build-from-source


# Start another Docker stage, so that the final image doesn't contain the layer with the build dependencies
# See previous FROM line; this must match
FROM node:22-alpine

ENV APP_BUNDLE_FOLDER /opt/bundle
ENV SCRIPTS_FOLDER /docker

#copy ./assets into the meteor assets folder
COPY ./mofacts/.deploy/assets/ /mofactsAssets/

#verify the presence of the settings.json file in the assets folder
RUN test -f /mofactsAssets/settings.json && echo "settings.json file found" || echo "settings.json file not found"

#set environment variable for meteor settings
ENV METEOR_SETTINGS_WORKAROUND /mofactsAssets/settings.json

# Install OS runtime dependencies
RUN apk --no-cache add \
	bash \
	ca-certificates

# Copy in entrypoint with the built and installed dependencies from the previous image
COPY --from=1 $SCRIPTS_FOLDER $SCRIPTS_FOLDER/

# Copy in app bundle with the built and installed dependencies from the previous image
COPY --from=1 $APP_BUNDLE_FOLDER/bundle $APP_BUNDLE_FOLDER/bundle/

# Start app
ENTRYPOINT ["/docker/entrypoint.sh"]

CMD ["node", "main.js"]
