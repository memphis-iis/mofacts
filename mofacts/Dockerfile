FROM node:12

# Install Meteor
RUN curl https://install.meteor.com/ | sh

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy app source code
COPY . .

# Build Meteor app
RUN meteor build --directory /usr/src/app/build --server-only --architecture=os.linux.x86_64

# Change working directory to the built app
WORKDIR /usr/src/app/build/bundle

# Install production dependencies
RUN (cd programs/server && npm install --production)

# Expose port 80
EXPOSE 80

# Start the app
CMD ["node", "main.js"]