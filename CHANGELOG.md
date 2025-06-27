## [1.8.2](https://github.com/rjlee/actual-auto-categorise/compare/v1.8.1...v1.8.2) (2025-06-27)


### Bug Fixes

* improve error handling by replacing console.log with console.error in API bundle patch ([31168bd](https://github.com/rjlee/actual-auto-categorise/commit/31168bd03e977127670d934ec6f036b9eabdde28))

## [1.8.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.8.0...v1.8.1) (2025-06-27)


### Bug Fixes

* enhance error logging in API bundle by replacing console.log with console.error ([8d574e9](https://github.com/rjlee/actual-auto-categorise/commit/8d574e90975ca8716f836b9ed6b1a75d4441535c))

# [1.8.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.7.1...v1.8.0) (2025-06-27)


### Bug Fixes

* handle potential absence of ESM i18next during initialization ([402d1df](https://github.com/rjlee/actual-auto-categorise/commit/402d1dfc8cba80928987479ac07f758e013f5495))


### Features

* initialize i18next for ESM build to ensure translation keys fall through ([13bd001](https://github.com/rjlee/actual-auto-categorise/commit/13bd001592dda98048ee02f5fa98a02d46c1f1ba))

## [1.7.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.7.0...v1.7.1) (2025-06-27)


### Bug Fixes

* ensure synchronous initialization for i18next missing-key handler ([4dc9a4c](https://github.com/rjlee/actual-auto-categorise/commit/4dc9a4ca5b8a47e96c9177cdf61b18c83909fb8d))

# [1.7.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.6.0...v1.7.0) (2025-06-27)


### Features

* add i18next and i18next-fs-backend for localization support ([a1167a8](https://github.com/rjlee/actual-auto-categorise/commit/a1167a8fda50852281bff98100d5e1fb41b37a72))

# [1.6.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.5.1...v1.6.0) (2025-06-27)


### Features

* add initial budget download and sync on daemon startup ([04657a3](https://github.com/rjlee/actual-auto-categorise/commit/04657a39e7d10a7c77ed359a4d86f03bd15f7e85))

## [1.5.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.5.0...v1.5.1) (2025-06-27)


### Bug Fixes

* update environment variables and paths for budget cache consistency ([dbb52e7](https://github.com/rjlee/actual-auto-categorise/commit/dbb52e7ae60535700e66d5800587c01298bea862))

# [1.5.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.4.0...v1.5.0) (2025-06-27)


### Bug Fixes

* update .gitignore files for improved directory exclusions and consistency ([014066c](https://github.com/rjlee/actual-auto-categorise/commit/014066c2df42564bedbe728f534af1812c93c779))


### Features

* add .gitignore and .gitkeep files for data and budget directories ([92702d4](https://github.com/rjlee/actual-auto-categorise/commit/92702d4cb3843af3befbd9670cdd46dba7f23328))

# [1.4.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.3.0...v1.4.0) (2025-06-23)


### Bug Fixes

* update ejs-lint command to use npx for better compatibility ([a839413](https://github.com/rjlee/actual-auto-categorise/commit/a839413ebedaef07ee104aff8c75ae078897661c))
* update lint:ejs command to use npx for better compatibility ([248bdf5](https://github.com/rjlee/actual-auto-categorise/commit/248bdf5f49249ec16d2217e12daf887e1fcc63ae))


### Features

* add EJS templating for web UI with authentication support ([85ae56b](https://github.com/rjlee/actual-auto-categorise/commit/85ae56bf27abb87ba116788032534b0aff43742c))

# [1.3.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.2.1...v1.3.0) (2025-06-22)

### Features

- enhance openBudget function to skip import backup based on DISABLE_IMPORT_BACKUPS environment variable ([ee88fb5](https://github.com/rjlee/actual-auto-categorise/commit/ee88fb56014546973b9380b76dc7aa3528e2c054))

## [1.2.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.2.0...v1.2.1) (2025-06-22)

### Bug Fixes

- ensure budget cache directory is created if it doesn't exist ([4432475](https://github.com/rjlee/actual-auto-categorise/commit/4432475da5eea54d7d5e26450f62ee4e97c1068c))

# [1.2.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.1...v1.2.0) (2025-06-21)

### Features

- enhance transaction description formatting in classification and training processes ([3ab2074](https://github.com/rjlee/actual-auto-categorise/commit/3ab2074810b29d81e96cca0b0548939480509aef))

## [1.1.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.0...v1.1.1) (2025-06-21)

### Bug Fixes

- update environment variable names for budget data directory consistency ([ef859fb](https://github.com/rjlee/actual-auto-categorise/commit/ef859fb593e1a2cf3eaf1a4430cba8e08fbb4d55))

# [1.1.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.0.4...v1.1.0) (2025-06-21)

### Features

- add DISABLE_CRON_SCHEDULING option to control cron job execution and update related documentation ([33b1ac6](https://github.com/rjlee/actual-auto-categorise/commit/33b1ac691808ba9b1246f646dcd0b5880b4aaec1))

## [1.0.4](https://github.com/rjlee/actual-auto-categorise/compare/v1.0.3...v1.0.4) (2025-06-21)

### Bug Fixes

- enhance README with additional Docker setup instructions and security note ([d6b0041](https://github.com/rjlee/actual-auto-categorise/commit/d6b0041f0abebce5b5c8cbea76d64c5208a4183b))

## [1.0.3](https://github.com/rjlee/actual-auto-categorise/compare/v1.0.2...v1.0.3) (2025-06-21)

### Bug Fixes

- update Node.js version requirement in README for clarity and consistency ([10d60be](https://github.com/rjlee/actual-auto-categorise/commit/10d60becd49c028744ec0156a7c4e2e6790c2705))

## [1.0.2](https://github.com/rjlee/actual-auto-categorise/compare/v1.0.1...v1.0.2) (2025-06-21)

### Bug Fixes

- update Node.js version requirements in package.json and README, adjust .nvmrc, and refactor Dockerfile stages ([c1bf854](https://github.com/rjlee/actual-auto-categorise/commit/c1bf85459623a7adea6b4dd0a7c6502590048ae1))

## [1.0.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.0.0...v1.0.1) (2025-06-21)

### Bug Fixes

- update Docker metadata action to v4 and enhance README with Docker usage instructions ([90700b5](https://github.com/rjlee/actual-auto-categorise/commit/90700b5a447e5ad89a14d047c962d0e54a90b9df))

# 1.0.0 (2025-06-21)

### Features

- add initial configuration files for Docker and environment setup ([56f93fe](https://github.com/rjlee/actual-auto-categorise/commit/56f93fe71a4f39b87519cbbe2caf018cab143dcd))
- initial commit ([c4d9082](https://github.com/rjlee/actual-auto-categorise/commit/c4d9082e703ee57b2e51c1af04d96ca553df1656))

## [1.18.3](https://github.com/rjlee/actual-auto-categorise/compare/v1.18.2...v1.18.3) (2025-06-21)

### Bug Fixes

- update npm plugin configuration to prevent accidental publishing ([bbed85f](https://github.com/rjlee/actual-auto-categorise/commit/bbed85f9244c0f43c78aebc6a48407656ca69587))

## [1.18.2](https://github.com/rjlee/actual-auto-categorise/compare/v1.18.1...v1.18.2) (2025-06-21)

### Bug Fixes

- set package.json as private to prevent accidental publishing ([e113604](https://github.com/rjlee/actual-auto-categorise/commit/e1136041cd17141f10e119c0eb15c5a71eed3858))

## [1.18.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.18.0...v1.18.1) (2025-06-21)

### Bug Fixes

- ensure fetch-depth is set to 0 during repository checkout in Docker workflow ([df50fef](https://github.com/rjlee/actual-auto-categorise/commit/df50fef6b9da4bf8224e9231d743e359a7a50952))

# [1.18.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.17.1...v1.18.0) (2025-06-21)

### Features

- add support for TensorFlow.js GPU version in package-lock.json ([7e2c0d4](https://github.com/rjlee/actual-auto-categorise/commit/7e2c0d4f77260ab9856efe46f7e7be9df4866094))
- integrate TensorFlow.js for classification and training ([2d26a8e](https://github.com/rjlee/actual-auto-categorise/commit/2d26a8e68235c9d73a1458a42529ffe49e36aae9))

## [1.17.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.17.0...v1.17.1) (2025-06-21)

### Bug Fixes

- add missing version declaration in docker-compose.yml ([ff57068](https://github.com/rjlee/actual-auto-categorise/commit/ff57068fbe3fb6aa8db5006bc72f5f85af67c25e))

# [1.17.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.16.0...v1.17.0) (2025-06-21)

### Features

- add support for encrypted Actual Budget files with optional password in environment variables ([341d398](https://github.com/rjlee/actual-auto-categorise/commit/341d39898a89663b19c436703d83853b8d79ea70))

# [1.16.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.15.0...v1.16.0) (2025-06-21)

### Bug Fixes

- correct searchK usage in classifyWithML and improve API mock structure in E2E tests ([b6250c3](https://github.com/rjlee/actual-auto-categorise/commit/b6250c33a1b07d9d2d85bf1c9bfb2f91edad6e6a))
- update disclaimer formatting for clarity in README ([ea12e9a](https://github.com/rjlee/actual-auto-categorise/commit/ea12e9a09197ad5e29ac827f40496bccc2e31307))

### Features

- add end-to-end pipeline test for training and classification using mocked API ([80c440e](https://github.com/rjlee/actual-auto-categorise/commit/80c440e1258f7937500af28ba1f6ec0962419867))
- update README to enhance environment variable documentation with descriptions and defaults ([c73d618](https://github.com/rjlee/actual-auto-categorise/commit/c73d6186be4b8e2e6f0774c0aebf5e2db2ce7810))

# [1.15.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.14.0...v1.15.0) (2025-06-21)

### Features

- refactor CLI argument parsing to improve structure and add tests for dispatcher functionality ([9a65364](https://github.com/rjlee/actual-auto-categorise/commit/9a65364b4911fd4b4c084a4a42d82d1ef2f32b6b))

# [1.14.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.13.0...v1.14.0) (2025-06-21)

### Features

- refactor CLI entrypoints for classify and train modules with improved error handling and logging ([3f498b7](https://github.com/rjlee/actual-auto-categorise/commit/3f498b7ce6b8d9dcddc69b2f12a4a66c660bb952))

# [1.13.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.12.0...v1.13.0) (2025-06-21)

### Features

- export scheduleClassification and scheduleTraining functions from daemon module ([6b3724d](https://github.com/rjlee/actual-auto-categorise/commit/6b3724df15d0867e0362567dfe872ac275ef1f89))

# [1.12.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.11.0...v1.12.0) (2025-06-21)

### Features

- enhance configuration loader with error handling and add tests for config utilities ([6aac06c](https://github.com/rjlee/actual-auto-categorise/commit/6aac06cd23b007c80ecd4556df23e8e42684e78d))

# [1.11.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.10.0...v1.11.0) (2025-06-21)

### Features

- update mlClassifier to require transformers pipeline for ESM interop and add unit tests for classifyWithML function ([135e942](https://github.com/rjlee/actual-auto-categorise/commit/135e942d5f28bc4496af3b7c5b81a955969ce6fc))

# [1.10.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.9.0...v1.10.0) (2025-06-21)

### Features

- add end-to-end tests for Web UI server and return server instance ([9729f29](https://github.com/rjlee/actual-auto-categorise/commit/9729f29f300735d44125b969deff1d727bd23fa5))
- improve error handling in openBudget function and update tests for budget operations ([a6bf112](https://github.com/rjlee/actual-auto-categorise/commit/a6bf112faa287f68fcd2d906ca66a250676d66e7))
- refactor training script and add unit tests for runTraining function ([843b8e4](https://github.com/rjlee/actual-auto-categorise/commit/843b8e4a5d87a60bbeef6ef19b4cb561b9babe08))

# [1.9.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.8.0...v1.9.0) (2025-06-20)

### Features

- add command line option to override web UI port ([194326e](https://github.com/rjlee/actual-auto-categorise/commit/194326e9e52a38a8ecefc64d6b27148fae06fba2))

# [1.8.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.7.0...v1.8.0) (2025-06-20)

### Features

- move cron scheduling and web UI to separate files ([3f2631f](https://github.com/rjlee/actual-auto-categorise/commit/3f2631fa7743140ec8216964b439de74bd259617))

# [1.7.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.6.0...v1.7.0) (2025-06-20)

### Features

- add web UI server for training and classification ([577dc3c](https://github.com/rjlee/actual-auto-categorise/commit/577dc3cca26263962ee24faa89a21ea8241e8efd))

# [1.6.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.5.0...v1.6.0) (2025-06-20)

### Features

- add step to fetch all tags in Docker workflow ([fe71bc1](https://github.com/rjlee/actual-auto-categorise/commit/fe71bc17e6bd69f0e5fccc896b4378342c6208b9))

# [1.5.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.4.0...v1.5.0) (2025-06-20)

### Features

- update Docker workflow to retrieve release version from git tag ([babe0d0](https://github.com/rjlee/actual-auto-categorise/commit/babe0d0a7d5ad4353f08ab7e92ae493555b62c93))

# [1.4.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.3.0...v1.4.0) (2025-06-20)

### Features

- enhance Docker workflow to support workflow_run events ([287666b](https://github.com/rjlee/actual-auto-categorise/commit/287666ba9a84c36d7a54ff29d562ea183b0d7831))

# [1.3.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.2.0...v1.3.0) (2025-06-20)

### Features

- add Docker Build & Publish workflow ([5c6f37f](https://github.com/rjlee/actual-auto-categorise/commit/5c6f37ffd321a092ee01405a7476f7fabd9d52be))

# [1.2.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.11...v1.2.0) (2025-06-20)

### Features

- add Docker build & publish workflow and update release process ([26bb284](https://github.com/rjlee/actual-auto-categorise/commit/26bb284c0841561e11cffffe49fe60d68e8ff5dd))

## [1.1.11](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.10...v1.1.11) (2025-06-20)

### Bug Fixes

- remove unnecessary comments from release workflow ([6d86762](https://github.com/rjlee/actual-auto-categorise/commit/6d867626bf6a6d1c2d73bcfab27beb71bb31ccb1))
- update CI & Release workflow to handle Docker image builds on pushes to the release branch and update README instructions ([8b3e66f](https://github.com/rjlee/actual-auto-categorise/commit/8b3e66fb09be020403a754e65136f99c529bf8d8))
- update semantic-release condition to include release branch ([766b017](https://github.com/rjlee/actual-auto-categorise/commit/766b017e22b3c90297d95635bd99a7e77f31a4db))

## [1.1.10](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.9...v1.1.10) (2025-06-20)

### Bug Fixes

- update docker-publish workflow trigger to use 'created' event and update README instructions ([2a56cf2](https://github.com/rjlee/actual-auto-categorise/commit/2a56cf28a60b43faaffbbad13f6c1a5743e2efe4))

## [1.1.9](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.8...v1.1.9) (2025-06-20)

### Bug Fixes

- update docker-publish workflow to trigger on GitHub Release publication and update README instructions ([2f41411](https://github.com/rjlee/actual-auto-categorise/commit/2f41411d79ea4c74f058e02176c3e0bbf7e41cd5))

## [1.1.8](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.7...v1.1.8) (2025-06-20)

### Bug Fixes

- update docker-publish workflow to trigger on pushes to the release branch and clarify README instructions ([f9ae08f](https://github.com/rjlee/actual-auto-categorise/commit/f9ae08f2342f7a5f57957d9d45ff0a34ada2b23a))

## [1.1.7](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.6...v1.1.7) (2025-06-20)

### Bug Fixes

- update docker-publish workflow to trigger on GitHub Release events and clarify README instructions ([c3c3b44](https://github.com/rjlee/actual-auto-categorise/commit/c3c3b4484137f1aada5f750e57a6727e8cb83cbf))

## [1.1.6](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.5...v1.1.6) (2025-06-20)

### Bug Fixes

- update Docker publish workflow to trigger on release branch and clarify README instructions ([c3b5ab3](https://github.com/rjlee/actual-auto-categorise/commit/c3b5ab33f9703b898b1439349bdf2109c52ed57c))

## [1.1.5](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.4...v1.1.5) (2025-06-20)

### Bug Fixes

- update Docker publish workflow trigger to run after Release workflow completion and clarify README instructions ([d28b3d9](https://github.com/rjlee/actual-auto-categorise/commit/d28b3d94d3b31a2d9972a17bda0105d4032d6039))

## [1.1.4](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.3...v1.1.4) (2025-06-20)

### Bug Fixes

- update Docker publish workflow trigger description and clarify README instructions ([083d194](https://github.com/rjlee/actual-auto-categorise/commit/083d19445d7dadfb524861d8a62e675c9a946ce8))

## [1.1.3](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.2...v1.1.3) (2025-06-20)

### Bug Fixes

- update Docker publish workflow trigger to activate on release publication and clarify README instructions ([48457cd](https://github.com/rjlee/actual-auto-categorise/commit/48457cd20a41b4c1072a05357bdb6866000a2f47))

## [1.1.2](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.1...v1.1.2) (2025-06-20)

### Bug Fixes

- update Docker publish workflow trigger to run after Release workflow completion and clarify README instructions ([e6eaecd](https://github.com/rjlee/actual-auto-categorise/commit/e6eaecd93ab09df8f7b2c560a17cd29f4803f2bb))

## [1.1.1](https://github.com/rjlee/actual-auto-categorise/compare/v1.1.0...v1.1.1) (2025-06-20)

### Bug Fixes

- update release trigger types in Docker publish workflow and clarify README instructions ([aa38183](https://github.com/rjlee/actual-auto-categorise/commit/aa38183e78993a260dcf181d49dcbec97b64adc5))

# [1.1.0](https://github.com/rjlee/actual-auto-categorise/compare/v1.0.0...v1.1.0) (2025-06-20)

### Features

- add Docker publish workflow and update README with Docker image details ([b284e8c](https://github.com/rjlee/actual-auto-categorise/commit/b284e8ca76671525c6d1f1cd41bd95f276b060fc))

# 1.0.0 (2025-06-20)

### Bug Fixes

- handle budget opening errors gracefully in training and classification runs ([ac083c9](https://github.com/rjlee/actual-auto-categorise/commit/ac083c9a358b08d410041baead170809e8f46bb9))
- remove coverage report upload step from CI workflow ([db32e2c](https://github.com/rjlee/actual-auto-categorise/commit/db32e2c457973d40c8bf79f6e15488adc8bac1f8))
- update budget data directory paths in configuration and suppress logging during budget closure ([65a47ec](https://github.com/rjlee/actual-auto-categorise/commit/65a47ecc98aadb0f9100f65a31513280c05b3016))
- update cron schedule to run every hour instead of once a day ([a9a3367](https://github.com/rjlee/actual-auto-categorise/commit/a9a336758570548155b79f1d14f29fced07ef618))

### Features

- add configuration support with .env.example and config files, enhance CLI with unified entry point ([be70977](https://github.com/rjlee/actual-auto-categorise/commit/be7097736c8cc0574406c19c58dcd8d2875d0284))
- add logging with pino and improve classification process ([0fa10be](https://github.com/rjlee/actual-auto-categorise/commit/0fa10be452625f2393c641e2a9b021155fcabb6a))
- add semantic-release configuration and release workflow for automated versioning and changelog generation ([01a705b](https://github.com/rjlee/actual-auto-categorise/commit/01a705b40dbde5dadb3f22c2ec7acb8dc6976c5a))
- add weekly training schedule and improve logging in training process ([8a54e36](https://github.com/rjlee/actual-auto-categorise/commit/8a54e360f4ded421165c208aaa359dbaf435bf39))
- enhance daemon mode to prevent overlapping executions during scheduled runs ([2273a8e](https://github.com/rjlee/actual-auto-categorise/commit/2273a8e8f4036aeae35e274b8e22876c3bae3683))
- update release workflow permissions and enhance README with GITHUB_TOKEN requirements ([1b4a35e](https://github.com/rjlee/actual-auto-categorise/commit/1b4a35e29c21df3070a50d43a6872f4810aca89e))
- validate cron expressions for classification and training schedules, log errors on invalid input ([9320b29](https://github.com/rjlee/actual-auto-categorise/commit/9320b29b9e339013e27f8ea38448d36edd5cbecc))
