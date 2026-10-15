# The tools that build-image.sh needs. build.sh runs it with --privileged, for the loop devices and the chroot.
FROM debian:trixie@sha256:913f6706df59a68922d1dd08f78c2476560a8d367897200a6005b00e5f67c2d5

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ansible ca-certificates curl dosfstools e2fsprogs fdisk mount python3 util-linux xz-utils zerofree \
    && rm -rf /var/lib/apt/lists/*
