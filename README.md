Under the hood, this project uses a two-step Embed+KNN approach:

1. **Text embedding**
   We use a WASM-backed transformer model (`Xenova/all-MiniLM-L6-v2`) to convert each transaction description into a fixed-length vector. Mean-pooling is applied across token embeddings to produce a single embedding per description.

2. **K-Nearest Neighbors classification**

- During training (`npm start -- --mode train`), reconciled transactions with existing categories are embedded and stored in `<DATA_DIR>/tx-classifier-knn`:
  - `meta.json` contains the number of neighbors (k), category labels, and embedding dimension.
  - `embeddings.bin` contains the saved embedding vectors.
- At prediction time (`npm start -- --mode classify`), new transaction descriptions are embedded the same way and normalized to unit length. We build an in-memory HNSW index (via `hnswlib-node`) over the training embeddings and perform an exact kNN search using cosine similarity.
- The predicted category is chosen by a majority vote among the k nearest neighbors.

This approach lets us efficiently classify transactions based on semantic textual similarity, without requiring an external service or GPU.

### TensorFlow.js classifier

The TensorFlow.js classifier uses a saved Layers model and the Universal Sentence Encoder for end-to-end neural classification.

1. **Text embedding**
   We use the Universal Sentence Encoder (via `@tensorflow-models/universal-sentence-encoder` + `@tensorflow/tfjs-node`) to embed each description into a fixed-length vector.

2. **Neural classification**
   A pre-trained TensorFlow.js Layers model (`model.json` + weight files) loads from disk, accepts the embeddings as input, and outputs a score per category. The highest-scoring category is chosen for each transaction.

### Classifier comparison

| Feature               | Embed+KNN (ml)                                   | TensorFlow.js (tf)                            |
| :-------------------- | :----------------------------------------------- | :-------------------------------------------- |
| Training time         | Fast (seconds–minutes) on CPU                    | Slower (minutes to hours; neural training)    |
| Inference speed       | Very fast (µs per sample)                        | Moderate (ms per batch)                       |
| CPU requirements      | Pure JS; no native addons                        | Requires `tfjs-node` native binding           |
| GPU support           | No GPU acceleration                              | Optional GPU with `tfjs-node-gpu`             |
| Dependencies          | Lightweight (JS only)                            | Heavy (tfjs-core, tfjs-node, USE)             |
| Model size            | Small (meta+bin ≈ few MB)                        | Moderate (model.json + shards ≈ tens of MB)   |
| Node.js compatibility | Node.js ≥20                                      | Node.js ≥20                                   |
| Flexibility           | Fixed kNN algorithm                              | Configurable neural network topology          |
| Accuracy              | Good baseline accuracy through nearest neighbors | Potentially higher with neural network tuning |
| Accuracy tuning       | Limited to k and embeddings                      | Tunable network architecture and parameters   |

## Daemon (scheduled classification)

Instead of running classification as a one-off, you can launch a background daemon that periodically classifies and applies new transactions on a cron schedule.

> **Note:** The daemon assumes a pre-trained model is already available in the data directory (`<DATA_DIR>/tx-classifier-knn`). Be sure to run the training step (`npm start -- --mode train`) at least once before starting the daemon.

1. Install dependencies (node-cron is included):

   ```bash
   npm install
   ```

2. Configure your desired cron expression and optional timezone via environment variables or config file (defaults to every hour on the hour UTC):

   ```bash
   # run every hour on the hour (default)
   export CLASSIFY_CRON="0 * * * *"
   export CLASSIFY_CRON_TIMEZONE="UTC"
   ```

3. Start the daemon:

   ```bash
   npm start -- --mode daemon
   ```

   On startup, the daemon will perform an initial budget download & sync before running any scheduled tasks.

### Optional Web UI

You can enable the web UI by either passing `--ui` **or** setting the `HTTP_PORT` environment variable (or `httpPort` in a config file). For example:

```bash
# Start daemon with UI via flag (default port 3000)
npm start -- --mode daemon --ui

# Or set HTTP_PORT to auto-enable UI on port 5007:
export HTTP_PORT=5007
npm start -- --mode daemon
```

The web UI is served on the configured port and presents a page with the application title and buttons for **Train** and **Classify**.

You can also override the port directly on the command line:

```bash
npm start -- --mode daemon --ui --http-port 8080
```

#### Web UI authentication

Session-based UI authentication is enabled by default. A signed session cookie is used (
`cookie-session` with a shared secret). The signing key comes from `SESSION_SECRET` (falling back to `ACTUAL_PASSWORD` if unset).

Set your password and session secret:

```bash
ACTUAL_PASSWORD=yourBudgetPassword
SESSION_SECRET=someLongRandomString
# To disable login form:
UI_AUTH_ENABLED=false
```

#### Web UI TLS/HTTPS

To serve the Web UI over HTTPS (recommended in production), set:

```bash
SSL_KEY=/path/to/privkey.pem    # path to SSL private key
SSL_CERT=/path/to/fullchain.pem # path to SSL certificate chain
```

Each run logs its start time and the number of updates applied. Errors are caught and logged without stopping the schedule.

## Security Considerations

> **Web UI security:** The Web UI displays your Actual Budget data in your browser.

- **Session-based UI authentication** (enabled by default): requires a signed session cookie (`cookie-session` with `SESSION_SECRET`).
  To disable the login form (open access), set `UI_AUTH_ENABLED=false`.

```bash
ACTUAL_PASSWORD=yourBudgetPassword
SESSION_SECRET=someLongRandomString
# To disable login form:
UI_AUTH_ENABLED=false
```

- **TLS/HTTPS:** strongly recommended for production. Set your SSL key and cert:

```bash
SSL_KEY=/path/to/privkey.pem    # path to SSL private key
SSL_CERT=/path/to/fullchain.pem # path to SSL certificate chain
```

**Disable Web UI:** omit `--ui` or remove the `HTTP_PORT` setting (local), or comment out the web service in Docker Compose.

- **Protect budget cache:** your `BUDGET_DIR` (or legacy `BUDGET_CACHE_DIR`) contains sensitive transaction details; secure it with proper filesystem permissions.

Each run logs its start time and the number of updates applied. Errors are caught and logged without stopping the schedule.

The daemon also prevents overlapping classification runs: if a previous classification run is still in progress when the next schedule fires, it will skip that interval.

In addition, the daemon schedules a weekly training run (default: every Monday at 06:30 UTC):

```bash
# run once a week on Monday at 06:30 UTC (default)
export TRAIN_CRON="30 6 * * 1"
export TRAIN_CRON_TIMEZONE="UTC"
```

Invalid cron expressions for `CLASSIFY_CRON` or `TRAIN_CRON` will cause the daemon to exit on startup.

### Optional: Event-based triggers (actual-events)

You can optionally listen to events from the companion `actual-events` sidecar to trigger near-real-time classification when new transactions arrive. This runs alongside the cron-based daemon (cron remains as a fallback) and debounces bursts of events to avoid redundant runs.

Enable and configure via environment variables (or your config file):

```bash
# Enable the event listener
ENABLE_EVENTS=true
# Point to the actual-events SSE endpoint; include filters in the URL if desired
EVENTS_URL=http://localhost:4000/events
# Optional bearer token if actual-events requires auth
EVENTS_AUTH_TOKEN=your-token
```

By default, the listener subscribes to `transaction.created` and `transaction.updated` events and triggers a classification run shortly after changes are detected. If you include your own query params in `EVENTS_URL`, they will be respected (otherwise defaults are applied).

## Testing & CI

We use Jest for unit tests and GitHub Actions for continuous integration.

```bash
# Run tests locally
npm test
```

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

| Key | Description | Default |
| --- | --- | --- |
| `DATA_DIR` | Directory for training data/model outputs | `./data` |
| `BUDGET_DIR` | Budget cache location | `./data/budget` |
| `CLASSIFY_CRON` | Classification schedule | `0 * * * *` |
| `TRAIN_CRON` | Training schedule | `30 6 * * 1` |
| `DISABLE_CRON_SCHEDULING` | Disable cron in daemon mode | `false` |
| `CLASSIFIER_TYPE` | `ml` or `tf` backend | `ml` |

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
