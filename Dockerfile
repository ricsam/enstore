# Use the official Bun image
# See tags at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

#
# Stage 1: Install dependencies
#
FROM base AS install
RUN mkdir -p /temp/dev/{server,cli,fs}
COPY package.json bun.lockb /temp/dev/
COPY server/package.json /temp/dev/server/
COPY cli/package.json /temp/dev/cli/
COPY fs/package.json /temp/dev/fs/

RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod/{server,cli,fs}
COPY package.json bun.lockb /temp/prod/
COPY server/package.json /temp/prod/server/
COPY cli/package.json /temp/prod/cli/
COPY fs/package.json /temp/prod/fs/
RUN cd /temp/prod && bun install --frozen-lockfile --production

#
# Stage 2: Pre-release (tests & build)
#
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ENV NODE_ENV=production
# Optional: run tests if you want to ensure everything is correct
RUN bun test

# If your code requires a build step (e.g., tsc), do it here
# RUN bun run build

#
# Stage 3: Final release image
#
FROM base AS release
WORKDIR /usr/src/app

# Copy production dependencies (minimal node_modules) from install stage
COPY --from=install /temp/prod/node_modules node_modules

# Copy your built code from prerelease stage
COPY --from=prerelease /usr/src/app/ .

# Link the CLI globally so it's available in the container
# Adjust to your actual folder if "server" is the CLI folder
RUN cd server && bun link && bun link @enstore/server


COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose port (default to 3000)
ENV PORT=3000
EXPOSE 3000/tcp

# This script checks ADMIN_USERNAME / ADMIN_PASSWORD, 
# adds an admin user if provided, then runs enstore-server start
ENTRYPOINT ["/app/docker-entrypoint.sh"]
