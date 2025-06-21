# actual-auto-categorise

This application trains a machine learning model on your categorized transactions in Actual Budget, and then uses it to auto-classify new unreconciled transactions.

## Requirements

- Node.js v20.x (LTS; required for TensorFlow.js compatibility)
- An instance of Actual Budget server running and accessible.

## Quick start with Docker

Copy `.env.example` to `.env` and fill in the required values (ACTUAL_SERVER_URL, ACTUAL_PASSWORD, ACTUAL_BUDGET_ID).

```bash
# Build the Docker image
docker build -t actual-auto-categorise .

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

## Setup

Install dependencies:

```bash
npm install
```

Configure environment variables in a `.env` file (or export them):

```
ACTUAL_SERVER_URL=http://localhost:5006
ACTUAL_PASSWORD=your_actual_password
ACTUAL_BUDGET_ID=your_budget_id
# Optional: path to store local budget data (default: ./budget)
ACTUAL_DATA_DIR=./budget
```

You can also use a JSON or YAML config file (`config.json`, `config.yaml`, or `config.yml`) in the project root to set default CLI options:

```yaml
# config.yaml example
# Base directory for budget data (train/ and classify/ subdirs created here)
dataDir: "./budget"
# Classification schedule (once an hour on the hour)
CLASSIFY_CRON: "0 * * * *"
CLASSIFY_CRON_TIMEZONE: UTC
# Training schedule (once a week Monday at 06:30 UTC)
TRAIN_CRON: "30 6 * * 1"
TRAIN_CRON_TIMEZONE: UTC
LOG_LEVEL: info
CLASSIFIER_TYPE: ml
```

This setting controls where the scripts will download and cache your Actual Budget files — one subdirectory per mode (`train/` and `classify/`).

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

The training run downloads a copy of your budget into `<ACTUAL_DATA_DIR>/train` (e.g. `./budget/train`).
On network or API errors during budget download, the training run will abort gracefully and wait until the next scheduled invocation.

This will generate training data and save the model to `data/tx-classifier-knn`.

> **Note:** The training data includes only reconciled transactions that already have a category.

## Classification

Retrieve new (unreconciled) transactions, classify them using the trained model, and update them in Actual Budget:

```bash
# via unified CLI
npm start -- --mode classify [--dry-run] [--verbose]
```

The classification run downloads a copy of your budget into `<ACTUAL_DATA_DIR>/classify` (e.g. `./budget/classify`).
On network or API errors during budget download, the classification run will abort gracefully and wait until the next scheduled invocation.

> **Note:** When run without `--dry-run`, the updated budget file is automatically uploaded with the new categories.

Options:
- `--dry-run`   perform classification without updating transactions
- `--verbose`   print each transaction and its predicted category

## How the classifiers work

This project supports two interchangeable classifier backends: the default Embed+KNN (ml) and an optional TensorFlow.js (tf) classifier. Select one via the `CLASSIFIER_TYPE` setting.

### Embed+KNN classifier (default)

Under the hood, this project uses a two-step Embed+KNN approach:

1. **Text embedding**
   We use a WASM-backed transformer model (`Xenova/all-MiniLM-L6-v2`) to convert each transaction description into a fixed-length vector. Mean-pooling is applied across token embeddings to produce a single embedding per description.

2. **K-Nearest Neighbors classification**
   - During training (`npm start -- --mode train`), reconciled transactions with existing categories are embedded and stored in `data/tx-classifier-knn`:
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

| Feature               | Embed+KNN (ml)                           | TensorFlow.js (tf)                              |
|:----------------------|:-----------------------------------------|:------------------------------------------------|
| Training time         | Fast (seconds–minutes) on CPU            | Slower (minutes to hours; neural training)      |
| Inference speed       | Very fast (µs per sample)                | Moderate (ms per batch)                         |
| CPU requirements      | Pure JS; no native addons                | Requires `tfjs-node` native binding             |
| GPU support           | No GPU acceleration                      | Optional GPU with `tfjs-node-gpu`              |
| Dependencies          | Lightweight (JS only)                    | Heavy (tfjs-core, tfjs-node, USE)               |
| Model size            | Small (meta+bin ≈ few MB)                | Moderate (model.json + shards ≈ tens of MB)     |
| Node.js compatibility | Node.js ≥20                              | Node.js 20 (ABI issues with ≥23)                |
| Flexibility           | Fixed kNN algorithm                      | Configurable neural network topology           |
| Accuracy               | Good baseline accuracy through nearest neighbors | Potentially higher with neural network tuning    |
| Accuracy tuning        | Limited to k and embeddings              | Tunable network architecture and parameters    |


## Daemon (scheduled classification)

Instead of running classification as a one-off, you can launch a background daemon that periodically classifies and applies new transactions on a cron schedule.
  
> **Note:** The daemon assumes a pre-trained model is already available in the data directory (`data/tx-classifier-knn`). Be sure to run the training step (`npm start -- --mode train`) at least once before starting the daemon.

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

Each run logs its start time and the number of updates applied. Errors are caught and logged without stopping the schedule.

The daemon also prevents overlapping classification runs: if a previous classification run is still in progress when the next schedule fires, it will skip that interval.

In addition, the daemon schedules a weekly training run (default: every Monday at 06:30 UTC):

```bash
# run once a week at Monday 06:30 UTC (default)
export TRAIN_CRON="30 6 * * 1"
export TRAIN_CRON_TIMEZONE="UTC"
```

Invalid cron expressions for `CLASSIFY_CRON` or `TRAIN_CRON` will cause the daemon to exit on startup.

## Testing & CI

We use Jest for unit tests and GitHub Actions for continuous integration.

```bash
# Run tests locally
npm test
```

On each push and pull request to `main`, GitHub Actions runs `npm ci` and `npm test` as part of the unified Release pipeline.

## Logging & Monitoring

All scripts emit structured JSON logs via [pino], including:

- `level`, `time`: log level and timestamp
- `appliedCount`, `durationMs`: number of transactions processed and run duration
- `dryRun`, `verbose`: run options
- errors are logged with full stack metadata

Set `LOG_LEVEL` (`info`, `debug`, etc.) to control verbosity.


## Environment Variables

You can set any of these via `.env` or your preferred config file (`config.yaml/json`):

| Variable                  | Description                                                      | Default       |
|:--------------------------|:-----------------------------------------------------------------|:-------------|
| `ACTUAL_SERVER_URL`       | URL of the Actual Budget server                                   | —            |
| `ACTUAL_PASSWORD`         | Password for Actual Budget API                                    | —            |
| `ACTUAL_BUDGET_ID`        | The Sync ID specified in Actual Budget Advanced Settings          | —            |
| `ACTUAL_BUDGET_ENCRYPTION_PASSWORD` | Password for encrypted Actual Budget file (optional)           | —            |
| `BUDGET_CACHE_DIR`        | Base directory for Actual Budget download cache (`train/`, `classify/`) | `./budget` |
| `ENABLE_NODE_VERSION_SHIM`| Shim for Node>=20 guard in `@actual-app/api` (daemon only)        | `false`      |
| `EMBED_BATCH_SIZE`        | Batch size for text embedding                                      | `512`        |
| `CLASSIFY_CRON`           | Cron schedule for classification daemon                            | `0 * * * *`  |
| `CLASSIFY_CRON_TIMEZONE`  | Timezone for classification cron                                   | `UTC`        |
| `TRAIN_CRON`              | Cron schedule for training daemon                                 | `30 6 * * 1` |
| `TRAIN_CRON_TIMEZONE`     | Timezone for training cron                                        | `UTC`        |
| `LOG_LEVEL`               | Logging level (`info`, `debug`, etc.)                              | `info`       |
| `CLASSIFIER_TYPE`         | Classifier backend to use (`ml` or `tf`)                           | `ml`         |
| `HTTP_PORT`               | Port for web UI server (daemon mode only)                         | `3000`       |

## Release Process

This project uses [semantic-release] to automate versioning, changelog generation, and GitHub releases.
Simply push Conventional Commits to `main` — the Release workflow will tag a new version, update `CHANGELOG.md`, and publish a GitHub Release automatically.
Docker image builds and publishes are handled by the same CI & Release workflow on pushes to the `release` branch.
**Ensure** your `GITHUB_TOKEN` (automatically provided in GitHub Actions) has write permission to releases and packages (via the workflow `permissions` field).

[semantic-release]: https://github.com/semantic-release/semantic-release

> **Disclaimer:** Users run this software at their own risk; no warranties are provided, and the authors are not liable for any data loss or unintended side effects.