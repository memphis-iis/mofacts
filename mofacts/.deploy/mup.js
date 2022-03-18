module.exports = {
  servers: {
    one: {
      host: '<target ip>',
      username: 'rusty',
      pem: '~/.ssh/id_rsa'
    }
  },
  app: {
    name: 'MoFACTs-Postgres',
    path: '../',
    volumes: {
      '<server feedback location>': '/feedback'
    },
    docker: {
      image: 'abernix/meteord:node-12-base',
      buildInstructions: [
        'RUN echo "deb http://apt.postgresql.org/pub/repos/apt stretch-pgdg main" > /etc/apt/sources.list.d/pgdg.list',
        'RUN apt-get update && apt-get install -y --allow-unauthenticated postgresql-9.3 postgresql-client-9.3 postgresql-contrib-9.3',
        'USER postgres',
        'RUN    /etc/init.d/postgresql start && psql --command "CREATE USER mofacts WITH SUPERUSER PASSWORD \'test101\';" && createdb -O mofacts mofacts',
        'RUN echo "host all  all    0.0.0.0/0  md5" >> /etc/postgresql/9.3/main/pg_hba.conf',
        'RUN echo "listen_addresses=\'*\'" >> /etc/postgresql/9.3/main/postgresql.conf',
        'EXPOSE 5432',
        'VOLUME  ["/etc/postgresql", "/var/log/postgresql", "/var/lib/postgresql"]'
      ]
    },
    servers: {
      one: {}
    },
    buildOptions: {
      serverOnly: true
    },
    env: {
      ROOT_URL: '<target ip>',
      MONGO_URL: 'mongodb://localhost/mofacts'
    }
  },
  mongo: {
    version: '4.2.0',
    servers: {
      one: {}
    }
  }
};
