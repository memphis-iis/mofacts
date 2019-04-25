FROM zodern/meteor
# ENV MONGO_URL="mongodb://192.168.0.1:27017/MoFaCT"
COPY --chown=app:app ./docker-out/mofacts.tar.gz /bundle/bundle.tar.gz
