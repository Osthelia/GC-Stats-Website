# Postgres image with SSL enabled, needed so Cloudflare (Hyperdrive/Workers VPC)
# can reach this instance over an encrypted connection. Self-signed cert, fine
# for a database that stays private (bound to 127.0.0.1 / reached only through
# the VPC), sslmode=require on the client side, not verify-full.

FROM postgres:16-alpine

RUN apk add --no-cache openssl \
  && mkdir -p /etc/postgresql/certs \
  && openssl req -new -x509 -days 3650 -nodes \
       -subj "/CN=gcstats-db" \
       -keyout /etc/postgresql/certs/server.key \
       -out /etc/postgresql/certs/server.crt \
  && chown postgres:postgres /etc/postgresql/certs/server.key /etc/postgresql/certs/server.crt \
  && chmod 600 /etc/postgresql/certs/server.key \
  && chmod 644 /etc/postgresql/certs/server.crt

CMD ["postgres", "-c", "ssl=on", "-c", "ssl_cert_file=/etc/postgresql/certs/server.crt", "-c", "ssl_key_file=/etc/postgresql/certs/server.key"]
