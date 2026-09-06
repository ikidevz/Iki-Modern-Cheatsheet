# Docker Cheatsheet

A structured, practical reference for Docker: images, containers, volumes, networks, Dockerfiles, Docker Compose, and day-to-day operations.

---

## 📑 Table of Contents

1. [🧱 Core Concepts](#core-concepts)
2. [⚡ Quick Reference Table](#quick-reference-table)
3. [🖼️ Image Commands](#image-commands)
4. [📦 Container Commands](#container-commands)
5. [📄 Dockerfile Reference](#dockerfile-reference)
6. [💾 Volumes](#volumes)
7. [🌐 Networks](#networks)
8. [🐳 Docker Compose](#docker-compose)
9. [📚 Registry & Docker Hub](#registry--docker-hub)
10. [🧹 System Management & Cleanup](#system-management--cleanup)
11. [🔍 Logging & Debugging](#logging--debugging)
12. [🚀 Build Optimization](#build-optimization)
13. [🔐 Security Basics](#security-basics)
14. [⚠️ Gotchas](#gotchas)

---

## 🧱 Core Concepts

| Concept            | What it is                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Image**          | A read-only template (layers + metadata) used to create containers. Built from a Dockerfile.                          |
| **Container**      | A running (or stopped) instance of an image — an isolated process with its own filesystem, network, and process tree. |
| **Volume**         | Persistent storage that lives outside a container's writable layer, managed by Docker.                                |
| **Bind mount**     | A host directory/file mounted directly into a container (not managed by Docker).                                      |
| **Network**        | A virtual network that lets containers talk to each other and/or the outside world.                                   |
| **Registry**       | A place images are stored/distributed (Docker Hub, ECR, GCR, private registries).                                     |
| **Dockerfile**     | A text file of instructions describing how to build an image.                                                         |
| **Docker Compose** | A tool/spec for defining and running multi-container applications from a single YAML file.                            |
| **Layer**          | Each Dockerfile instruction that modifies the filesystem creates a cached, immutable layer.                           |
| **Tag**            | A human-readable pointer to a specific image (e.g. `myapp:1.2.0`, `myapp:latest`).                                    |

---

## ⚡ Quick Reference Table

| Task                        | Command                                       |
| --------------------------- | --------------------------------------------- |
| Build image                 | `docker build -t name:tag .`                  |
| Run container               | `docker run -d --name c1 -p 8080:80 name:tag` |
| List running containers     | `docker ps`                                   |
| List all containers         | `docker ps -a`                                |
| List images                 | `docker images`                               |
| Stop container              | `docker stop c1`                              |
| Remove container            | `docker rm c1`                                |
| Remove image                | `docker rmi name:tag`                         |
| Exec into running container | `docker exec -it c1 bash`                     |
| View logs                   | `docker logs -f c1`                           |
| Inspect object              | `docker inspect c1`                           |
| Copy files in/out           | `docker cp c1:/path ./local`                  |
| Pull image                  | `docker pull name:tag`                        |
| Push image                  | `docker push name:tag`                        |
| Tag image                   | `docker tag src:tag dest:tag`                 |
| List volumes                | `docker volume ls`                            |
| List networks               | `docker network ls`                           |
| Compose up                  | `docker compose up -d`                        |
| Compose down                | `docker compose down`                         |
| Compose logs                | `docker compose logs -f service`              |
| Clean up everything unused  | `docker system prune -a --volumes`            |
| Show resource usage         | `docker stats`                                |
| Show image layer history    | `docker history name:tag`                     |

---

## 🖼️ Image Commands

```bash
# Build an image from a Dockerfile in the current directory
docker build -t myapp:1.0 .

# Build with a specific Dockerfile and build context
docker build -t myapp:1.0 -f docker/Dockerfile.prod .

# Build with build arguments
docker build --build-arg NODE_ENV=production -t myapp:1.0 .

# Build without using cache
docker build --no-cache -t myapp:1.0 .

# List local images
docker images
docker image ls

# Remove an image
docker rmi myapp:1.0

# Remove all dangling (untagged) images
docker image prune

# Tag an image (needed before pushing to a registry)
docker tag myapp:1.0 myregistry.com/myapp:1.0

# Pull / push
docker pull nginx:1.27
docker push myregistry.com/myapp:1.0

# Inspect image metadata (env vars, entrypoint, layers, etc.)
docker inspect myapp:1.0

# Show the layer-by-layer build history and size of each layer
docker history myapp:1.0

# Save an image to a tar file / load it back (offline transfer)
docker save -o myapp.tar myapp:1.0
docker load -i myapp.tar

# Show what a container's filesystem looked like vs. the image
docker diff <container>
```

---

## 📦 Container Commands

```bash
# Run a container in detached mode, map a port, name it
docker run -d --name web -p 8080:80 nginx:1.27

# Run interactively with a shell (auto-remove on exit)
docker run -it --rm ubuntu:24.04 bash

# Run with an env file / individual env vars
docker run --env-file .env -e DEBUG=true myapp:1.0

# Run with a bind mount and a named volume
docker run -v $(pwd):/app -v mydata:/var/lib/data myapp:1.0

# Run with resource limits
docker run --memory=512m --cpus=1.5 myapp:1.0

# List containers
docker ps          # running only
docker ps -a       # all, including stopped

# Start / stop / restart
docker start web
docker stop web
docker restart web

# Stop with a shorter grace period (default is 10s SIGTERM before SIGKILL)
docker stop -t 3 web

# Remove a container (must be stopped, unless -f)
docker rm web
docker rm -f web              # force remove even if running
docker container prune        # remove all stopped containers

# Execute a command in a running container
docker exec -it web bash
docker exec web ls /app

# View / copy files
docker cp web:/app/logs ./logs
docker cp ./config.json web:/app/config.json

# Live resource usage
docker stats
docker stats web --no-stream

# Rename a container
docker rename web web-old

# Pause / unpause (freezes all processes without stopping)
docker pause web
docker unpause web

# Inspect low-level details (IP address, mounts, env, etc.)
docker inspect web
docker inspect -f '{{.NetworkSettings.IPAddress}}' web
```

---

## 📄 Dockerfile Reference

| Instruction   | Purpose                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `FROM`        | Base image to build from. Must be the first instruction (aside from `ARG` before it).                              |
| `RUN`         | Executes a command at build time, creates a new layer.                                                             |
| `CMD`         | Default command run when the container starts (overridable at `docker run`). Only one per Dockerfile takes effect. |
| `ENTRYPOINT`  | Fixed command that always runs; `CMD` becomes its default arguments.                                               |
| `COPY`        | Copies files/directories from build context into the image.                                                        |
| `ADD`         | Like `COPY`, but also supports URLs and auto-extracts tar archives (prefer `COPY` unless you need those).          |
| `WORKDIR`     | Sets the working directory for subsequent instructions and at runtime.                                             |
| `ENV`         | Sets environment variables (persist into the running container).                                                   |
| `ARG`         | Build-time-only variable (not available at runtime unless also passed to `ENV`).                                   |
| `EXPOSE`      | Documents which port the container listens on (does _not_ publish it — that's `-p`).                               |
| `VOLUME`      | Declares a mount point, causing Docker to create an anonymous volume there if none is supplied.                    |
| `USER`        | Sets the user (and optionally group) subsequent instructions and the container run as.                             |
| `LABEL`       | Adds metadata key/value pairs to the image.                                                                        |
| `HEALTHCHECK` | Defines a command Docker uses to check container health.                                                           |
| `SHELL`       | Overrides the default shell used for `RUN`/`CMD`/`ENTRYPOINT` shell-form.                                          |
| `ONBUILD`     | Registers an instruction to run when _this_ image is used as a base for another build.                             |

**Example — multi-stage Node.js build:**

```dockerfile
# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./

# Run as non-root
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

**CMD vs ENTRYPOINT:**

```dockerfile
# CMD alone: fully overridable
CMD ["node", "server.js"]
# docker run myimage          -> runs: node server.js
# docker run myimage echo hi  -> runs: echo hi  (CMD replaced entirely)

# ENTRYPOINT + CMD: CMD supplies default args to ENTRYPOINT
ENTRYPOINT ["node"]
CMD ["server.js"]
# docker run myimage          -> runs: node server.js
# docker run myimage app.js   -> runs: node app.js   (only CMD part replaced)
```

---

## 💾 Volumes

```bash
# Create / list / inspect / remove a named volume
docker volume create mydata
docker volume ls
docker volume inspect mydata
docker volume rm mydata

# Remove all unused volumes
docker volume prune

# Use a named volume (Docker-managed, survives container removal)
docker run -v mydata:/var/lib/postgresql/data postgres:16

# Use a bind mount (host path, useful for local dev / live-reloading code)
docker run -v $(pwd)/src:/app/src myapp:1.0

# Read-only mount
docker run -v mydata:/data:ro myapp:1.0

# tmpfs mount (in-memory, never persisted to disk)
docker run --tmpfs /app/cache myapp:1.0

# Long-form --mount syntax (more explicit, preferred in scripts)
docker run --mount type=volume,source=mydata,target=/data myapp:1.0
docker run --mount type=bind,source=$(pwd),target=/app myapp:1.0
```

| Type         | Managed by          | Typical use                                                          |
| ------------ | ------------------- | -------------------------------------------------------------------- |
| Named volume | Docker              | Databases, persistent app data, portable across hosts running Docker |
| Bind mount   | Host OS             | Local development, mounting config/source code from the host         |
| tmpfs        | Memory (Linux only) | Sensitive/temp data that should never touch disk                     |

---

## 🌐 Networks

```bash
# List / inspect / remove networks
docker network ls
docker network inspect bridge
docker network rm mynet

# Create a custom bridge network (recommended over default bridge)
docker network create mynet

# Run containers attached to it — they can resolve each other by container name
docker run -d --name db --network mynet postgres:16
docker run -d --name app --network mynet myapp:1.0
# from inside "app": connecting to host "db" reaches the postgres container

# Connect/disconnect a running container to/from a network
docker network connect mynet web
docker network disconnect mynet web

# Publish a container port to the host
docker run -p 8080:80 nginx        # host:container
docker run -p 127.0.0.1:8080:80 nginx  # bind only to localhost
docker run -P nginx                # publish all EXPOSEd ports to random host ports
```

| Driver             | Use case                                                                                |
| ------------------ | --------------------------------------------------------------------------------------- |
| `bridge` (default) | Single-host container-to-container communication                                        |
| `host`             | Container shares the host's network stack directly (no port mapping needed, Linux only) |
| `none`             | No networking at all                                                                    |
| `overlay`          | Multi-host communication (Docker Swarm)                                                 |
| `macvlan`          | Assign a container its own MAC/IP on the physical network                               |

---

## 🐳 Docker Compose

```yaml
# docker-compose.yml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./src:/app/src
    networks:
      - appnet

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: example
    volumes:
      - dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - appnet

volumes:
  dbdata:

networks:
  appnet:
```

```bash
# Start all services (build if needed), detached
docker compose up -d

# Rebuild images before starting
docker compose up -d --build

# Stop and remove containers, networks (keeps volumes)
docker compose down

# Also remove named volumes
docker compose down --volumes

# View logs (all services, or one)
docker compose logs -f
docker compose logs -f web

# Run a one-off command in a service
docker compose exec web bash
docker compose run --rm web npm test

# List services and their status
docker compose ps

# Scale a service to multiple replicas
docker compose up -d --scale web=3

# Validate/print the fully resolved config
docker compose config

# Use a specific compose file / override
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Notes:

- Modern Compose (v2, the `docker compose` plugin) no longer requires a `version:` key at the top of the file — it's ignored if present.
- `depends_on` with `condition: service_healthy` waits for the dependency's `HEALTHCHECK` to pass, not just for the container to start.
- `.env` in the same directory as `docker-compose.yml` is loaded automatically for variable substitution (`${VAR}`) inside the compose file itself.

---

## 📚 Registry & Docker Hub

```bash
# Log in / out
docker login
docker login myregistry.com
docker logout

# Tag an image for a specific registry before pushing
docker tag myapp:1.0 myregistry.com/myteam/myapp:1.0
docker push myregistry.com/myteam/myapp:1.0

# Pull from a private registry
docker pull myregistry.com/myteam/myapp:1.0

# Run a local registry (useful for testing)
docker run -d -p 5000:5000 --name registry registry:2

# Search Docker Hub from the CLI
docker search postgres
```

---

## 🧹 System Management & Cleanup

```bash
# Disk usage summary (images, containers, volumes, build cache)
docker system df

# Remove all stopped containers, unused networks, dangling images, build cache
docker system prune

# Also remove unused (not just dangling) images and volumes — aggressive
docker system prune -a --volumes

# Targeted cleanup
docker container prune   # stopped containers
docker image prune       # dangling images
docker image prune -a    # all unused images
docker volume prune      # unused volumes
docker network prune     # unused networks
docker builder prune     # build cache

# Show real-time events (container start/stop/die, etc.)
docker events

# Version / info about the Docker daemon and host
docker version
docker info
```

---

## 🔍 Logging & Debugging

```bash
# Follow logs live, with timestamps, last 100 lines
docker logs -f --tail 100 --timestamps web

# Logs since a given time
docker logs --since 10m web

# Attach to a running container's stdin/stdout (careful: detach with Ctrl+P, Ctrl+Q)
docker attach web

# See what changed on a container's filesystem vs. its image
docker diff web

# Show the processes running inside a container
docker top web

# Full low-level JSON dump (env, mounts, network, restart policy, etc.)
docker inspect web

# Get a specific field with a Go template
docker inspect -f '{{.State.Health.Status}}' web
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' web

# Check exit code / reason a container stopped
docker inspect -f '{{.State.ExitCode}}' web
docker ps -a --filter "status=exited"
```

---

## 🚀 Build Optimization

```dockerfile
# Order instructions from least- to most-frequently-changing
# so Docker's layer cache is reused across builds
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci              # cached as long as package*.json is unchanged
COPY . .                # only invalidates cache when source changes
RUN npm run build
```

```
# .dockerignore — keep the build context small and avoid leaking secrets
.git
node_modules
npm-debug.log
Dockerfile*
.dockerignore
.env
dist
*.md
```

Other techniques:

- **Multi-stage builds** — compile/build in one stage, copy only the final artifacts into a slim runtime stage (see Dockerfile example above). Drastically reduces final image size.
- **Smaller base images** — prefer `alpine` or `-slim` variants where the tooling allows it.
- **BuildKit** — enabled by default in modern Docker; gives parallel stage builds, better caching, and `--mount=type=cache` for package manager caches:
  ```dockerfile
  RUN --mount=type=cache,target=/root/.npm npm ci
  ```
- **Combine RUN instructions** that install-then-clean-up into a single layer to avoid bloating intermediate layers:
  ```dockerfile
  RUN apt-get update && apt-get install -y curl \
      && rm -rf /var/lib/apt/lists/*
  ```
- **Pin versions** (base image tags, package versions) for reproducible builds.

---

## 🔐 Security Basics

- **Don't run as root inside the container.** Create a dedicated user in the Dockerfile and set `USER`.
- **Never bake secrets into image layers** (env vars, `COPY`ing `.env` files, etc.) — they persist in the image history even if a later layer "removes" them. Use `--mount=type=secret` (BuildKit) or inject secrets at runtime instead.
- **Use `.dockerignore`** to keep `.git`, `.env`, and credentials out of the build context entirely.
- **Prefer minimal base images** (`alpine`, `distroless`) to shrink the attack surface.
- **Run containers read-only where possible**: `docker run --read-only --tmpfs /tmp myapp`.
- **Drop unnecessary Linux capabilities**: `docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myapp`.
- **Scan images for known vulnerabilities**: `docker scout cveimage:tag` (or Trivy, Grype, etc.).
- **Set resource limits** (`--memory`, `--cpus`) to reduce blast radius of a compromised or runaway container.
- **Avoid `--privileged`** unless truly necessary — it disables most container isolation.

---

## ⚠️ Gotchas

- **`docker stop` doesn't kill immediately** — it sends `SIGTERM`, waits (10s default), then `SIGKILL`s. Apps that don't handle `SIGTERM` will always take the full timeout to stop.
- **`EXPOSE` in a Dockerfile does nothing to actual networking** — it's documentation only. You still need `-p host:container` (or `-P`) at `docker run` to publish a port.
- **The default `bridge` network doesn't do automatic DNS resolution by container name** — only _user-defined_ bridge networks (`docker network create`) let containers resolve each other by name. This trips people up constantly when they skip creating a custom network.
- **Bind mounts hide the image's content at that path** — mounting an empty host directory over `/app` will make `/app` empty in the container, even if the image had files there.
- **Anonymous volumes from `VOLUME` in a Dockerfile pile up silently** — every `docker run` without an explicit mount for that path creates a new anonymous volume; `docker volume prune` is the cleanup.
- **`docker rm -f` on a running container skips graceful shutdown entirely** — it's a hard kill, not a stop-then-remove.
- **`latest` is not "the newest version"** — it's just a tag like any other, and only means "the most recently pushed image tagged `latest`" if the maintainer chose to push it that way. Pin real versions in production.
- **Build cache invalidates from the first changed instruction onward** — even if only your app code changed, putting `COPY . .` before `RUN npm ci` forces a full reinstall on every build. Order matters (see Build Optimization).
- **`ENV` values persist into the running container and `docker inspect` output** — don't use `ENV` for secrets; anyone with `docker inspect` access can read them.
- **`ADD`'s auto-extraction behavior is easy to trigger by accident** — a `.tar.gz` passed to `ADD` gets extracted into the image, which `COPY` will never do. Use `COPY` unless you specifically want that.
- **Stopping a Compose project with `down` removes networks and (by default) anonymous volumes, but keeps named volumes** — add `--volumes` explicitly if you want a full wipe, and remember that's destructive for databases.
- **Multiple `CMD`/`ENTRYPOINT` instructions in a Dockerfile don't stack** — only the last one of each takes effect; earlier ones are silently overridden.
- **Containers exiting immediately after `docker run` usually means the main process exited**, not that Docker failed — check `docker logs` and confirm the container's `CMD` is a long-running foreground process, not something that returns immediately.
