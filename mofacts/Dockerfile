# Use the official Meteor image as the base image
FROM abernix/meteord:node-12-base

# Copy the app to the container
COPY . /app

# Set the working directory to the app directory
WORKDIR /app

# Install any necessary dependencies
RUN meteor npm install

# Build the app for production
RUN meteor build --directory /built_app --server-only --architecture=os.linux.x86_64

# Set the working directory to the built app directory
WORKDIR /built_app/bundle

# Install any necessary dependencies for the built app
RUN (cd programs/server && npm install)

# Expose port 80 for the app
EXPOSE 80

# Start the app
CMD node main.js