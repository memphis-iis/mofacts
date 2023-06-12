# Set the base image to Alpine Linux
FROM openjdk:8-jre-alpine

# Set the working directory to /app
WORKDIR /app

# Copy the syllables.jar file to the container
COPY syllables.jar .

# Expose port 4567 for the app to listen on
EXPOSE 4567

# Start the app
CMD ["java", "-jar", "syllables.jar", "-p", "4567"]