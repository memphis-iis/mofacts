#create a volume using a volume driver, local for working directory's subdirectory ./mofacts_config and ./bundle
docker run -it --rm --name mofacts -p 80:80 -v $(pwd)/mofacts_config:/mofacts_config mofacts $(pwd)/bundle:/bundle