# yum4less-osm stores a US OpenStreetMap extract and a grocery-only file.
# Nothing runs on a timer inside the image. A TrueNAS Cron Job runs:
#   docker exec yum4less-osm osm-refresh
# Fixed user: name osm, uid 8456, gid 8456.

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates=20250419~deb12u2 \
        osmium-tool=1.15.0-1 \
        pyosmium=3.6.0-1 \
        python3-pyosmium=3.6.0-1+b1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 8456 osm \
    && useradd --uid 8456 --gid 8456 --home-dir /home/osm --create-home --shell /usr/sbin/nologin osm

COPY osm-refresh /usr/local/bin/osm-refresh
RUN chmod 0755 /usr/local/bin/osm-refresh

USER osm
WORKDIR /data
ENTRYPOINT ["sleep", "infinity"]
