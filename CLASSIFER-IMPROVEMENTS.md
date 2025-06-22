# KNN Classifier

Below are several concrete levers you can pull to boost the accuracy of your Embed+KNN pipeline.

## 1. Hyperparameter tuning: k and distance weighting

**What:**
- Vary the number of neighbors *k* (e.g. try 3, 5, 7, 9) instead of always using 5.
- Weight neighbors by inverse distance (so closer points vote more strongly than farther ones).

**Why:**
Different budgets/categories have different cluster compactness. A smaller *k* may work better if your categories form tight clusters; a larger *k* can stabilize noisy data. Distance‑weighted voting often corrects ties and gives more influence to the nearest embeddings.

## 2. Clean up & normalize text

**What:**
- Lowercase everything, strip punctuation, collapse repeated whitespace.
- Remove boilerplate words from payees/notes (e.g. “POS”, “Transaction”, “Payment”).

**Why:**
Cleaner text embeds more consistently. Residual “noise” such as bank codes or generic words can confuse the model into treating distinctly different descriptions as similar.

## 3. Enrich or fine‑tune embeddings

**What:**
- Fine‑tune a BERT/DistilBERT model on your own transaction text (payee + notes).
- Train a sentence‑transformers head on your historical labeled transactions for domain adaptation.

**Why:**
Off‑the‑shelf embeddings are generic. Fine‑tuning on your own data makes them capture the specific context of your budgeting use case (e.g. distinguishing “Coffee Shop” vs “Coffee Beans”).

## 4. Add more context features

**What:**
- Include transaction date features (day‑of‑week, month).
- Incorporate account ID or budget context.

**Why:**
Temporal and contextual signals help disambiguate recurring payments or account‑specific patterns that text alone cannot capture.

## 5. Balance & clean the training set

**What:**
- Remove outliers (one‑off large transactions) and incorrect labels.
- Oversample under‑represented categories to ensure they have enough neighbors.

**Why:**
Sparse or noisy categories reduce KNN reliability. A well‑balanced, clean dataset yields a more robust index.

## 6. Tune HNSW index parameters

**What:**
- Tune construction parameters (e.g. M, efConstruction) when building the index.
- Increase search parameter *ef* at query time for more accurate neighbor retrieval.

**Why:**
An approximate HNSW index may miss true nearest neighbors. Raising *ef* or *M* improves recall of close points with minimal latency impact.

## 7. Confidence thresholding & fallback

**What:**
- Compute a confidence score (neighbor‑vote fraction).
- If confidence is below a threshold (e.g. < 60%), skip auto‑categorization or flag for review.

**Why:**
KNN can be uncertain in sparse embedding regions. Handling low‑confidence cases reduces misclassifications.

## 8. Automate evaluation

**What:**
- Hold out a validation set of historical transactions and benchmark precision/recall per category.
- Track metrics as you adjust hyperparameters or preprocessing steps.

**Why:**
Systematic evaluation prevents blind tuning and surfaces which changes truly improve accuracy.

## 9. Ensemble with TensorFlow classifier

**What:**
- Run both Embed+KNN and the TF.js classifier in parallel.
- When they agree, apply the category; when they differ, take the higher‑confidence result or prompt for manual review.

**Why:**
Combining two complementary classification methods often outperforms either one alone, especially in edge cases.

## TF Classifier

Below are suggestions for improving the accuracy of the TensorFlow.js neural classifier.

### 1. Network architecture & hyperparameters
**What:** Experiment with different layer sizes, activation functions, learning rates, batch sizes, and number of epochs. Add or remove hidden layers, tune dropout rates, and apply L1/L2 regularization.
**Why:** Small changes to the network topology or training regimen can yield significant accuracy gains and reduce overfitting.

### 2. Fine‑tune the text encoder
**What:** Instead of using the Universal Sentence Encoder off the shelf, fine‑tune the encoder jointly with your classification head on your labeled transactions.
**Why:** Domain‑specific text patterns (merchant names, personal notes) are better captured when the embedding model sees your data during training.

### 3. Data augmentation
**What:** Apply simple augmentations such as synonym replacement, random insertion/removal of tokens, or back‑translation to expand your labeled dataset.
**Why:** Augmentation reduces overfitting and helps the model generalize to variations in payee names and notes.

### 4. Numeric & categorical features
**What:** Concatenate non‑text features (amount, day‑of‑week, account ID) to the neural input—either by embedding those features or appending them to the text representation.
**Why:** Neural networks can leverage both text and structured features jointly, improving classification when text alone is ambiguous.

### 5. Class imbalance handling
**What:** Use class weights in the loss function or oversample under‑represented categories in each training batch.
**Why:** Prevents the model from ignoring rare categories and improves recall on minority classes.

### 6. Early stopping & cross-validation
**What:** Implement early stopping based on validation loss, and use k‑fold cross‑validation or a held‑out test set to monitor performance.
**Why:** Guards against overfitting and provides reliable estimates of real‑world accuracy across all categories.

### 7. Ensembling multiple TF heads
**What:** Train multiple neural classifier variants (different initial seeds or hyperparameters) and ensemble their predictions (majority vote or averaged probabilities).
**Why:** Ensembling reduces variance and often outperforms any single model instance.

### 8. Automated hyperparameter search
**What:** Use tools like Keras Tuner or Optuna to automate the search for optimal learning rates, batch sizes, and layer configurations.
**Why:** Systematic search often finds better settings faster than manual tuning.

### 9. Monitoring & interpretability
**What:** Track training/validation curves, confusion matrices, and class‑specific metrics. Use attention or SHAP explanations on select examples.
**Why:** Visibility into model behavior helps diagnose failure modes and target data collection or cleaning efforts.