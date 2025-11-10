# actual-auto-categorise

Automatic transaction categorisation for Actual Budget. Trains local models, serves a CLI/daemon, and ships a Docker image so you can keep categories tidy without leaving your automation stack.

## Features

- Embedding + KNN classifier by default, with optional TensorFlow.js model for experimentation.
- `train`, `classify`, and long-running `daemon` modes with consistent logging and graceful shutdown.
- Cron-based scheduling with optional `actual-events` stream integration for near real-time updates.
- Optional Web UI for triggering runs and checking status (fronted by Traefik for auth).
- Docker image with baked-in health check, Node.js 22 base image, and bind-mount friendly data directory.

## Requirements

- Node.js ≥ 22.
- Actual Budget server credentials (`ACTUAL_SERVER_URL`, `ACTUAL_PASSWORD`, `ACTUAL_SYNC_ID`).
- Writable data directory for embeddings, TensorFlow assets, and the budget cache (defaults to `./data`).

## Installation

```bash
git clone https://github.com/rjlee/actual-auto-categorise.git
cd actual-auto-categorise
npm install
```

Optional git hooks:

```bash
npm run prepare
```

### Docker quick start

```bash
cp .env.example .env
docker build -t actual-auto-categorise .
mkdir -p data/budget
docker run -d --env-file .env \
  -p 5007:5007 \
  -v "$(pwd)/data:/app/data" \
  actual-auto-categorise --mode daemon --ui --http-port 5007
```

Published images live at `ghcr.io/rjlee/actual-auto-categorise:<tag>` (see [Image tags](#image-tags)).

> `docker-compose.yml` includes Traefik plus the shared `actual-auto-auth` forwarder (pulled from GHCR). Set `AUTH_APP_NAME` to control the login heading shown to operators, override the image with `AUTH_FORWARD_IMAGE` if you pin a specific tag, and keep `AUTH_COOKIE_NAME` in sync with the proxy so the logout button appears when you’re authenticated.

For Compose users, two sample manifests are provided:

- `docker-compose.no-auth.yml.example` – exposes the web UI directly on `HTTP_PORT`.
- `docker-compose.with-auth.yml.example` – bundles Traefik + `actual-auto-auth`
  so operators must authenticate before accessing the UI (the existing
  `docker-compose.yml` mirrors this setup for backward compatibility).

## Configuration

- `.env` – primary configuration, copy from `.env.example`.
- `config.yaml` / `config.yml` / `config.json` – optional defaults, copy from `config.example.yaml`.

Precedence: CLI flags > environment variables > config file.

| Setting                                              | Description                                 | Default                                 |
| ---------------------------------------------------- | ------------------------------------------- | --------------------------------------- |
| `BUDGET_DIR` (`BUDGET_CACHE_DIR`)                    | Budget cache location                       | `./data/budget`                         |
| `DATA_DIR`                                           | Training data + model artefacts             | `./data`                                |
| `CLASSIFIER_TYPE`                                    | `ml` (embed+KNN) or `tf` (TensorFlow)       | `ml`                                    |
| `LOG_LEVEL`                                          | Pino log level                              | `info`                                  |
| `CLASSIFY_CRON` / `CLASSIFY_CRON_TIMEZONE`           | Classification schedule                     | `0 * * * *` / `UTC`                     |
| `TRAIN_CRON` / `TRAIN_CRON_TIMEZONE`                 | Weekly training schedule                    | `30 6 * * 1` / `UTC`                    |
| `DISABLE_CRON_SCHEDULING`                            | Disable cron when running daemon            | `false`                                 |
| `ENABLE_EVENTS` / `EVENTS_URL` / `EVENTS_AUTH_TOKEN` | Hook into `actual-events` SSE stream        | disabled                                |
| `HTTP_PORT`                                          | Enables Web UI when set or `--ui` passed    | `3000`                                  |
| `SSL_KEY`, `SSL_CERT`                                | Optional TLS for the Web UI                 | unset                                   |
| `AUTH_FORWARD_IMAGE`                                 | Auth proxy image pulled by Docker Compose   | `ghcr.io/rjlee/actual-auto-auth:latest` |
| `AUTH_APP_NAME`                                      | Text shown on the shared login screen       | `Actual Auto Categorise`                |
| `AUTH_COOKIE_NAME`                                   | Cookie name issued by the shared auth proxy | `actual-auth`                           |
| `TF_TRAIN_*`, `EMBED_BATCH_SIZE`                     | Advanced ML tuning knobs                    | see `.env.example`                      |

## Usage

### CLI modes

- Train models: `npm run train` (alias for `npm start -- --mode train`).
- Classify once: `npm run classify` (`--mode classify`).
- Cron daemon: `npm run daemon` with optional `--ui`, `--http-port`, `--classifier-type tf`.

### Event-triggered classification

Set `ENABLE_EVENTS=true` and point `EVENTS_URL` at your `actual-events` instance to debounce and trigger classification runs shortly after new transactions arrive. Cron remains active as a safety net unless `DISABLE_CRON_SCHEDULING=true`.

### Docker daemon

```bash
docker run -d --env-file .env \
  -p 5007:5007 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/rjlee/actual-auto-categorise:latest --mode daemon --ui --http-port 5007
```

## Testing & linting

```bash
npm test
npm run test:coverage
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Image tags

- `ghcr.io/rjlee/actual-auto-categorise:<semver>` – pinned to a specific `@actual-app/api` release.
- `ghcr.io/rjlee/actual-auto-categorise:latest` – highest supported API version.

See [rjlee/actual-auto-ci](https://github.com/rjlee/actual-auto-ci) for release automation and tag policy.

## License

MIT © contributors.
