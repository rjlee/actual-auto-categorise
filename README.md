# actual-auto-categorise

Automatic transaction categorisation for Actual Budget. Trains local models, serves a CLI/daemon, and ships a Docker image so you can keep categories tidy without leaving your automation stack.

## Features

- Embedding + KNN classifier by default, with optional TensorFlow.js model for experimentation.
- `train`, `classify`, and long-running `daemon` modes with consistent logging and graceful shutdown.
- Cron-based scheduling with optional `actual-events` stream integration for near real-time updates.
- Optional Web UI (session auth + TLS) for triggering runs and checking status.
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

## Configuration

- `.env` – primary configuration, copy from `.env.example`.
- `config.yaml` / `config.yml` / `config.json` – optional defaults, copy from `config.example.yaml`.

Precedence: CLI flags > environment variables > config file.

| Setting                                              | Description                              | Default                      |
| ---------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| `BUDGET_DIR` (`BUDGET_CACHE_DIR`)                    | Budget cache location                    | `./data/budget`              |
| `DATA_DIR`                                           | Training data + model artefacts          | `./data`                     |
| `CLASSIFIER_TYPE`                                    | `ml` (embed+KNN) or `tf` (TensorFlow)    | `ml`                         |
| `LOG_LEVEL`                                          | Pino log level                           | `info`                       |
| `CLASSIFY_CRON` / `CLASSIFY_CRON_TIMEZONE`           | Classification schedule                  | `0 * * * *` / `UTC`          |
| `TRAIN_CRON` / `TRAIN_CRON_TIMEZONE`                 | Weekly training schedule                 | `30 6 * * 1` / `UTC`         |
| `DISABLE_CRON_SCHEDULING`                            | Disable cron when running daemon         | `false`                      |
| `ENABLE_EVENTS` / `EVENTS_URL` / `EVENTS_AUTH_TOKEN` | Hook into `actual-events` SSE stream     | disabled                     |
| `HTTP_PORT`                                          | Enables Web UI when set or `--ui` passed | `3000`                       |
| `UI_AUTH_ENABLED`, `SESSION_SECRET`                  | Session-auth toggle and cookie secret    | `true`, fallback to password |
| `SSL_KEY`, `SSL_CERT`                                | Optional TLS for the Web UI              | unset                        |
| `TF_TRAIN_*`, `EMBED_BATCH_SIZE`                     | Advanced ML tuning knobs                 | see `.env.example`           |

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

# Enable the event listener

ENABLE_EVENTS=true

# Point to the actual-events SSE endpoint; include filters in the URL if desired

EVENTS_URL=http://localhost:4000/events

# Optional bearer token if actual-events requires auth

EVENTS_AUTH_TOKEN=your-token

````

By default, the listener subscribes to `transaction.created` and `transaction.updated` events and triggers a classification run shortly after changes are detected. If you include your own query params in `EVENTS_URL`, they will be respected (otherwise defaults are applied).

## Testing & CI

We use Jest for unit tests and GitHub Actions for continuous integration.

```bash
# Run tests locally
npm test
````

On each push and pull request to `main`, GitHub Actions runs linting (`npm run lint`), formatting checks (`npm run format:check`), installs dependencies (`npm ci`), and runs tests (`npm test`) as part of the unified Release pipeline.

## Logging & Monitoring

All scripts emit structured JSON logs via [pino], including:

- `level`, `time`: log level and timestamp
- `appliedCount`, `durationMs`: number of transactions processed and run duration
- `dryRun`, `verbose`: run options
- errors are logged with full stack metadata

Set `LOG_LEVEL` (`info`, `debug`, etc.) to control verbosity.

## Environment Variables

You can set any of these via `.env` or your preferred config file (`config.yaml/json`):

| Variable                            | Description                                                                                 | Default         |
| :---------------------------------- | :------------------------------------------------------------------------------------------ | :-------------- |
| `ACTUAL_SERVER_URL`                 | URL of the Actual Budget server                                                             | —               |
| `ACTUAL_PASSWORD`                   | Password for Actual Budget API (and for Web UI login)                                       | —               |
| `ACTUAL_SYNC_ID`                    | The Sync ID specified in Actual Budget Advanced Settings                                    | —               |
| `ACTUAL_BUDGET_ENCRYPTION_PASSWORD` | Password for encrypted Actual Budget file (optional)                                        | —               |
| `DATA_DIR`                          | Base directory for training data and model outputs                                          | `./data`        |
| `BUDGET_DIR`                        | Base directory for Actual Budget download cache (only the latest downloaded budget is kept) | `./data/budget` |
| `BUDGET_CACHE_DIR`                  | _Deprecated_: alias for `BUDGET_DIR` (only the latest downloaded budget is kept)            | `./data/budget` |
| `ENABLE_NODE_VERSION_SHIM`          | Shim for Node>=20 guard in `@actual-app/api` (daemon only)                                  | `false`         |
| `EMBED_BATCH_SIZE`                  | Batch size for text embedding                                                               | `512`           |
| `CLASSIFY_CRON`                     | Cron schedule for classification daemon                                                     | `0 * * * *`     |
| `CLASSIFY_CRON_TIMEZONE`            | Timezone for classification cron                                                            | `UTC`           |
| `TRAIN_CRON`                        | Cron schedule for training daemon                                                           | `30 6 * * 1`    |
| `TRAIN_CRON_TIMEZONE`               | Timezone for training cron                                                                  | `UTC`           |
| `DISABLE_CRON_SCHEDULING`           | Disable cron scheduling (daemon mode only)                                                  | `false`         |
| `LOG_LEVEL`                         | Logging level (`info`, `debug`, etc.)                                                       | `info`          |
| `CLASSIFIER_TYPE`                   | Classifier backend to use (`ml` or `tf`)                                                    | `ml`            |
| `HTTP_PORT`                         | Port for web UI server (daemon mode only)                                                   | `3000`          |
| `UI_AUTH_ENABLED`                   | Enable/disable Web UI login form (true/false)                                               | `true`          |
| `SSL_KEY`                           | Path to SSL private key for HTTPS Web UI                                                    | —               |
| `SSL_CERT`                          | Path to SSL certificate chain for HTTPS Web UI                                              | —               |

## Release Process

This project uses [semantic-release] to automate versioning, changelog generation, and GitHub releases.
Simply push Conventional Commits to `main` — the Release workflow will tag a new version, update `CHANGELOG.md`, and publish a GitHub Release automatically.
Linting (ESLint) and formatting (Prettier) are enforced in CI prior to running tests.
Docker image builds and publishes are handled by the same CI & Release workflow on pushes to the `release` branch.
**Ensure** your `GITHUB_TOKEN` (automatically provided in GitHub Actions) has write permission to releases and packages (via the workflow `permissions` field).

[semantic-release]: https://github.com/semantic-release/semantic-release

> **Disclaimer:** Users run this software at their own risk; no warranties are provided, and the authors are not liable for any data loss or unintended side effects.

## Releases & Docker

We use GitHub Actions + semantic-release to automate version bumps, changelogs, and GitHub releases. Docker images are built via a reusable matrix workflow:

- **CI**: runs on pushes and PRs to `main` (lint, format-check, tests).
- **Release**: runs after CI succeeds (or manually). Uses semantic-release to publish a GitHub release when conventional commits indicate a new version.
- **Docker build**: runs after Release and nightly at 23:00 UTC. Publishes API‑versioned images.

## Docker

- Pull latest image: `docker pull ghcr.io/rjlee/actual-auto-categorise:latest`
- Run with env file:
  - `docker run --rm --env-file .env ghcr.io/rjlee/actual-auto-categorise:latest`
- Persist data by mounting `./data` to `/app/data`
- Or via compose: `docker-compose up -d`

## Image Tags

We publish stable `@actual-app/api` versions (exact semver) plus `latest` (alias of the highest stable). CI builds the latest patch for the last three stable API majors and applies labels:

- `io.actual.api.version` — the `@actual-app/api` version
- `org.opencontainers.image.revision` — git SHA
- `org.opencontainers.image.version` — app version

### Examples

- Pin a specific API patch: `docker run --rm --env-file .env ghcr.io/rjlee/actual-auto-categorise:25.11.0`
- Follow the newest supported API major: `docker run --rm --env-file .env ghcr.io/rjlee/actual-auto-categorise:latest`

## Release Strategy

- **App releases (semantic‑release):**
  - Manage versioning and changelog in this repo (no separate Docker tags for app versions).
- **Docker images (compatibility):**
  - Scope: latest patch of the last three stable `@actual-app/api` majors.
  - Tags per image: exact semver plus `latest` (highest stable).
  - Purpose: let you match your Actual server’s API line without changing your app version.

## Choosing an Image Tag

- We publish stable `@actual-app/api` versions (exact semver) plus `latest` (alias of the highest stable). See the release strategy in `rjlee/actual-auto-ci`.
- Examples: `ghcr.io/rjlee/actual-auto-categorise:25.11.0` (pinned) or `ghcr.io/rjlee/actual-auto-categorise:latest`.
- Always pick a semver tag that matches your Actual server’s `@actual-app/api` version, or use `latest` if you want the newest supported version automatically.

### Tips

- You can list available tags via the GHCR UI under “Packages” for this repo
- If you run a self‑hosted Actual server, choose the image whose API major matches your server’s API line

### Compose Defaults

- Set `ACTUAL_IMAGE_TAG` (e.g. `25.11.0`) in `.env` to pin to a specific semver tag, or leave it unset to follow `latest`.

# actual-auto-categorise

Auto-train and apply transaction categorisation for [Actual Budget](https://actualbudget.org/). The daemon keeps a local cache of your budget, trains a model on existing categories, then classifies new unreconciled transactions on a schedule or on demand.

## Features

- Embed+KNN classifier (default) with optional TensorFlow.js backend.
- Web UI for manual train/classify cycles.
- Cron-based daemon with SSE integration (via `actual-events`) for near-real-time updates.
- Docker image with built-in health checks and budget cache volume.

## Requirements

- Node.js ≥ 20 (TensorFlow.js bindings require Node 20+).
- Reachable Actual Budget server (`ACTUAL_SERVER_URL` + credentials).
- Sufficient disk space for budget cache and model artefacts (default `./data`).

## Installation

```bash
git clone https://github.com/rjlee/actual-auto-categorise.git
cd actual-auto-categorise
npm install
```

Enable lint-staged hooks (optional):

```bash
npm run prepare
```

### Docker

```bash
cp .env.example .env
docker build -t actual-auto-categorise .
mkdir -p data data/budget
docker run --rm --env-file .env -v "$(pwd)/data:/app/data" actual-auto-categorise
```

Prebuilt images are published to `ghcr.io/rjlee/actual-auto-categorise:<tag>` (see [Image tags](#image-tags)).

## Configuration

- `.env` – copy `.env.example` and fill required values (`ACTUAL_SERVER_URL`, `ACTUAL_PASSWORD`, `ACTUAL_SYNC_ID`).
- `config.yaml`/`config.yml`/`config.json` – optional defaults for CLI/daemon flags; see `config.example.yaml` for available keys.

Precedence: CLI flags > environment variables > config file defaults.

Common keys:

| Key                       | Description                               | Default         |
| ------------------------- | ----------------------------------------- | --------------- |
| `DATA_DIR`                | Directory for training data/model outputs | `./data`        |
| `BUDGET_DIR`              | Budget cache location                     | `./data/budget` |
| `CLASSIFY_CRON`           | Classification schedule                   | `0 * * * *`     |
| `TRAIN_CRON`              | Training schedule                         | `30 6 * * 1`    |
| `DISABLE_CRON_SCHEDULING` | Disable cron in daemon mode               | `false`         |
| `CLASSIFIER_TYPE`         | `ml` or `tf` backend                      | `ml`            |

For self-signed Actual instances, set `NODE_TLS_REJECT_UNAUTHORIZED=0` (accepts insecure TLS).

## Usage

### One-off modes

```bash
# Train
npm start -- --mode train

# Classify (dry-run example)
npm start -- --mode classify --dry-run
```

### Daemon mode

```bash
npm start -- --mode daemon --ui --http-port 5007
```

The daemon downloads the budget into `BUDGET_DIR`, runs scheduled train/classify jobs, serves the optional web UI and health check, and listens for events when `ENABLE_EVENTS=true` and `EVENTS_URL` is provided.

### Docker examples

```bash
# Classify once
docker run --rm --env-file .env ghcr.io/rjlee/actual-auto-categorise:latest --mode classify

# Daemon with UI and persistent state
docker run -d --env-file .env \
  -p 5007:5007 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/rjlee/actual-auto-categorise:latest --mode daemon --ui --http-port 5007
```

## Testing & linting

```bash
npm test
npm run lint        # reports issues
npm run lint:fix    # auto-fixes ESLint
npm run format      # Prettier write
npm run format:check
```

## Image tags

- `ghcr.io/rjlee/actual-auto-categorise:<semver>` – pinned API version (match your Actual server’s `@actual-app/api` line).
- `ghcr.io/rjlee/actual-auto-categorise:latest` – highest supported API release.

See [rjlee/actual-auto-ci](https://github.com/rjlee/actual-auto-ci) for release automation and tag policy.

## Troubleshooting

- Budget cache errors: ensure `BUDGET_DIR` is writable and credentials are correct.
- TensorFlow.js issues: confirm Node 20+ and install optional GPU bindings if required.
- Event listener delays: adjust `LOOKBACK_DAYS`, `SCAN_INTERVAL_MS`, or integrate with `actual-events`.

## License

MIT © contributors. See repository for details.
