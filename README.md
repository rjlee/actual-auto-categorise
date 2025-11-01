# actual-auto-categorise

This application trains a machine learning model on your categorized transactions in Actual Budget, and then uses it to auto-classify new unreconciled transactions.

## Requirements

- Node.js ≥20 (required for TensorFlow.js compatibility)
- An instance of Actual Budget server running and accessible.

## Quick start with Docker

Copy `.env.example` to `.env` and fill in the required values (ACTUAL_SERVER_URL, ACTUAL_PASSWORD, ACTUAL_SYNC_ID).

```bash
# Build the Docker image
docker build -t actual-auto-categorise .

# Prepare required host dirs for data (model & budget)
mkdir -p data data/budget

# Run using your .env file
docker run --rm --env-file .env actual-auto-categorise
```

You can also run one-off commands. For example, to classify only:

```bash
docker run --rm --env-file .env actual-auto-categorise npm start -- --mode classify
```

If you have Docker Compose installed:

```bash
docker-compose up -d
```

Then open your browser to `http://<HOST>:5007`, click **Train** to train the model, then **Classify** to categorize your transactions.

## Setup

> **Note:** Ensure you are running on Node.js ≥20. The Node ≥20 engine range is required for ABI compatibility with TensorFlow.js native bindings and WASM transformer support.

Install dependencies:

```bash
npm install
```

### Linting and formatting

After installing dependencies, you can lint the code and enforce formatting:

```bash
npm run lint
npm run lint:fix
npm run format
```

#### Git hooks (pre-commit)

To enable automatic lint-and-format on staged files, install the Husky pre-commit hook:

```bash
npm run prepare
```

This creates a Git pre-commit hook that runs lint-staged on your `.js` files.

Configure environment variables in a `.env` file (or export them):

```
ACTUAL_SERVER_URL=http://localhost:5006
ACTUAL_PASSWORD=your_actual_password
ACTUAL_SYNC_ID=your_sync_id
# Optional: path to store local training data and model outputs (default: ./data)
DATA_DIR=./data
# Optional: path to store local budget cache (downloaded budget files; default: ./data/budget)
BUDGET_DIR=./data/budget
# Legacy alias for BUDGET_DIR (deprecated)
BUDGET_CACHE_DIR=./data/budget
```

> **Security note:** If connecting to a self-signed Actual Budget instance, set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your environment. This disables certificate verification and makes TLS/HTTPS requests insecure.

You can also use a JSON or YAML config file (`config.json`, `config.yaml`, or `config.yml`) in the project root to set default CLI options:

```yaml
# config.yaml example
# Base directory for training data and model outputs (default: ./data)
dataDir: './data'
# Base directory for budget data (downloaded budget files; default: ./data/budget)
budgetDir: './data/budget'
# Classification schedule (once an hour on the hour)
CLASSIFY_CRON: '0 * * * *'
CLASSIFY_CRON_TIMEZONE: UTC
# Training schedule (once a week Monday at 06:30 UTC)
TRAIN_CRON: '30 6 * * 1'
TRAIN_CRON_TIMEZONE: UTC
# Disable cron scheduling (daemon mode only; default: false)
DISABLE_CRON_SCHEDULING: false
# Logging level (info, debug, error)
LOG_LEVEL: info
# Classifier to use: 'ml' for Embed+KNN or 'tf' for TensorFlow.js (default: ml)
CLASSIFIER_TYPE: ml

# Mark newly categorized transactions as reconciled and cleared when true; set to false to disable (default: true)
AUTO_RECONCILE: true
# Optional delay (in days) before applying cleared/reconciled; 0 means immediate (default: 5)
AUTO_RECONCILE_DELAY_DAYS: 5
```

A sample YAML config file is provided in `config.example.yaml`. Copy it to `config.yaml` or `config.yml` in the project root and adjust as needed.

See `.env.example` for all supported environment variables and defaults.

## Training

Retrieve past transactions and train the model (Embed+KNN by default):

```bash
# via unified CLI (Embed+KNN)
npm start -- --mode train
```

```bash
# Or TF.js classifier training
CLASSIFIER_TYPE=tf npm start -- --mode train
```

The training run downloads a copy of your budget into `<BUDGET_DIR>` (e.g. `./data/budget`). Previous budget files are not retained; each download overwrites the existing file in the cache directory.
On network or API errors during budget download, the training run will abort gracefully and wait until the next scheduled invocation.

This will generate training data and save the model to `<DATA_DIR>/tx-classifier-knn`.

> **Note:** The training data includes only reconciled transactions that already have a category.

## Classification

Retrieve new (unreconciled) transactions, classify them using the trained model, and update them in Actual Budget:

```bash
# via unified CLI
npm start -- --mode classify [--dry-run] [--verbose]
```

The classification run downloads a copy of your budget into `<BUDGET_DIR>` (e.g. `./data/budget`). Previous budget files are not retained; each download overwrites the existing file in the cache directory.
On network or API errors during budget download, the classification run will abort gracefully and wait until the next scheduled invocation.

> **Note:** When run without `--dry-run`, the updated budget file is automatically uploaded. By default (`AUTO_RECONCILE=true`), unreconciled transactions are marked cleared and reconciled once eligible by delay rules (see below). For on-budget accounts, a category is set only if missing; existing categories are not changed. Off-budget accounts are never assigned a category but are still cleared/reconciled per the delay.

> Budget scope: The classifier scans transactions from all accounts (on-budget and off-budget). However, it only sets a category for transactions in on-budget accounts. Reconciliation and clearing are still applied according to `AUTO_RECONCILE` for both on-budget and off-budget accounts.

> Reconcile/Clear delay: You can delay when transactions are marked cleared and reconciled by setting `AUTO_RECONCILE_DELAY_DAYS` (default: 5). When greater than 0, the app only clears/reconciles transactions whose transaction date is at least that many days in the past. Categories (for on-budget accounts) are applied immediately for uncategorized transactions regardless of this delay.

Options:

- `--dry-run` perform classification without updating transactions
- `--verbose` print each transaction and its predicted category

## How the classifiers work

This project supports two interchangeable classifier backends: the default Embed+KNN (ml) and an optional TensorFlow.js (tf) classifier. Select one via the `CLASSIFIER_TYPE` setting.

### Embed+KNN classifier (default)

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

| Variable                            | Description                                                                                                            | Default         |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :-------------- |
| `ACTUAL_SERVER_URL`                 | URL of the Actual Budget server                                                                                        | —               |
| `ACTUAL_PASSWORD`                   | Password for Actual Budget API (and for Web UI login)                                                                  | —               |
| `ACTUAL_SYNC_ID`                    | The Sync ID specified in Actual Budget Advanced Settings                                                               | —               |
| `ACTUAL_BUDGET_ENCRYPTION_PASSWORD` | Password for encrypted Actual Budget file (optional)                                                                   | —               |
| `DATA_DIR`                          | Base directory for training data and model outputs                                                                     | `./data`        |
| `BUDGET_DIR`                        | Base directory for Actual Budget download cache (only the latest downloaded budget is kept)                            | `./data/budget` |
| `BUDGET_CACHE_DIR`                  | _Deprecated_: alias for `BUDGET_DIR` (only the latest downloaded budget is kept)                                       | `./data/budget` |
| `AUTO_RECONCILE`                    | When true, auto clear/reconcile unreconciled transactions (respecting delay); only set category if missing (on-budget) | `true`          |
| `AUTO_RECONCILE_DELAY_DAYS`         | Days to wait before setting `cleared` and `reconciled`; set to `0` for immediate                                       | `5`             |
| `ENABLE_NODE_VERSION_SHIM`          | Shim for Node>=20 guard in `@actual-app/api` (daemon only)                                                             | `false`         |
| `EMBED_BATCH_SIZE`                  | Batch size for text embedding                                                                                          | `512`           |
| `CLASSIFY_CRON`                     | Cron schedule for classification daemon                                                                                | `0 * * * *`     |
| `CLASSIFY_CRON_TIMEZONE`            | Timezone for classification cron                                                                                       | `UTC`           |
| `TRAIN_CRON`                        | Cron schedule for training daemon                                                                                      | `30 6 * * 1`    |
| `TRAIN_CRON_TIMEZONE`               | Timezone for training cron                                                                                             | `UTC`           |
| `DISABLE_CRON_SCHEDULING`           | Disable cron scheduling (daemon mode only)                                                                             | `false`         |
| `LOG_LEVEL`                         | Logging level (`info`, `debug`, etc.)                                                                                  | `info`          |
| `CLASSIFIER_TYPE`                   | Classifier backend to use (`ml` or `tf`)                                                                               | `ml`            |
| `HTTP_PORT`                         | Port for web UI server (daemon mode only)                                                                              | `3000`          |
| `UI_AUTH_ENABLED`                   | Enable/disable Web UI login form (true/false)                                                                          | `true`          |
| `SSL_KEY`                           | Path to SSL private key for HTTPS Web UI                                                                               | —               |
| `SSL_CERT`                          | Path to SSL certificate chain for HTTPS Web UI                                                                         | —               |

## Release Process

This project uses [semantic-release] to automate versioning, changelog generation, and GitHub releases.
Simply push Conventional Commits to `main` — the Release workflow will tag a new version, update `CHANGELOG.md`, and publish a GitHub Release automatically.
Linting (ESLint) and formatting (Prettier) are enforced in CI prior to running tests.
Docker image builds and publishes are handled by the same CI & Release workflow on pushes to the `release` branch.
**Ensure** your `GITHUB_TOKEN` (automatically provided in GitHub Actions) has write permission to releases and packages (via the workflow `permissions` field).

[semantic-release]: https://github.com/semantic-release/semantic-release

> **Disclaimer:** Users run this software at their own risk; no warranties are provided, and the authors are not liable for any data loss or unintended side effects.
