import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB0
import numpy as np
import pandas as pd
import os
from PIL import Image
from sklearn.model_selection import train_test_split

IMG_SIZE = 224  # EfficientNetB0 native size

# ── Data loading ──────────────────────────────────────────────────────────────

def load_image(path):
    img = Image.open(path).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    return np.array(img, dtype=np.float32) / 255.0

def load_dataset(csv_path, images_dir):
    df = pd.read_csv(csv_path)   # columns: filename, score
    X, y = [], []
    for _, row in df.iterrows():
        path = os.path.join(images_dir, row["filename"])
        X.append(load_image(path))
        y.append(float(row["score"]) / 100.0)   # normalize 0–1
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


# ── Augmentation (critical for small datasets) ────────────────────────────────

def augment(image, label):
    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_flip_up_down(image)
    image = tf.image.random_brightness(image, 0.15)
    image = tf.image.random_contrast(image, 0.8, 1.2)
    image = tf.image.random_saturation(image, 0.8, 1.2)
    image = tf.clip_by_value(image, 0.0, 1.0)
    return image, label


# ── Model ─────────────────────────────────────────────────────────────────────

def build_model(freeze_base=True):
    base = EfficientNetB0(
        include_top=False,
        weights="imagenet",       # pretrained on ImageNet
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        pooling="avg"             # global average pool after base
    )
    base.trainable = not freeze_base   # freeze in phase 1, unfreeze in phase 2

    model = keras.Sequential([
        base,
        layers.Dense(64, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(1, activation="sigmoid")   # output: 0–1
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss="mse",
        metrics=["mae"]
    )
    return model


# ── Two-phase training (key technique for small datasets) ─────────────────────

def train(csv_path, images_dir, epochs_phase1=30, epochs_phase2=20):
    X, y = load_dataset(csv_path, images_dir)
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Build tf.data pipelines
    train_ds = (tf.data.Dataset.from_tensor_slices((X_train, y_train))
                .shuffle(500)
                .map(augment, num_parallel_calls=tf.data.AUTOTUNE)
                .batch(8)
                .prefetch(tf.data.AUTOTUNE))

    val_ds = (tf.data.Dataset.from_tensor_slices((X_val, y_val))
              .batch(8)
              .prefetch(tf.data.AUTOTUNE))

    callbacks = [
        keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(patience=5, factor=0.5),
        keras.callbacks.ModelCheckpoint("turbidity_cnn.keras", save_best_only=True)
    ]

    # ── Phase 1: train only the top layers, base frozen ──────────────────────
    print("Phase 1: training top layers only...")
    model = build_model(freeze_base=True)
    model.fit(train_ds, validation_data=val_ds,
              epochs=epochs_phase1, callbacks=callbacks)

    # ── Phase 2: unfreeze top 20 layers of base and fine-tune with low LR ────
    print("\nPhase 2: fine-tuning top layers of base network...")
    model = keras.models.load_model("turbidity_cnn.keras")
    model.layers[0].trainable = True                        # unfreeze base
    for layer in model.layers[0].layers[:-20]:             # refreeze all but top 20
        layer.trainable = False

    model.compile(
        optimizer=keras.optimizers.Adam(1e-4),             # 10x lower LR
        loss="mse",
        metrics=["mae"]
    )
    model.fit(train_ds, validation_data=val_ds,
              epochs=epochs_phase2, callbacks=callbacks)

    best = keras.models.load_model("turbidity_cnn.keras")
    val_mae = best.evaluate(val_ds, verbose=0)[1]
    print(f"\nFinal val error: ±{val_mae*100:.1f} pts out of 100")
    return best


# ── Inference ─────────────────────────────────────────────────────────────────

def score_image(image_path):
    model = keras.models.load_model("turbidity_cnn.keras")
    img = load_image(image_path)[np.newaxis, :]            # add batch dim
    score = model.predict(img, verbose=0)[0][0] * 100
    return round(float(score), 1)


# ── Run ───────────────────────────────────────────────────────────────────────

model = train("labels.csv", "./dive_images")
print(score_image("new_dive.png"))