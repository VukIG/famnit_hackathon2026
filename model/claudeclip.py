import numpy as np
import pandas as pd
import os
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from sklearn.model_selection import train_test_split
import open_clip                          # pip install open-clip-torch

# ── Config ────────────────────────────────────────────────────────────────────

DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "ViT-B-32"
PRETRAINED = "openai"

# ── Load CLIP ─────────────────────────────────────────────────────────────────

clip_model, _, preprocess = open_clip.create_model_and_transforms(
    MODEL_NAME, pretrained=PRETRAINED
)
clip_model = clip_model.to(DEVICE).eval()

# Freeze entirely — we never update CLIP weights
for param in clip_model.parameters():
    param.requires_grad = False


# ── STEP 0 (optional): Zero-shot sanity check BEFORE labeling ─────────────────
# Run this on a few images to verify CLIP understands your domain

def zero_shot_check(image_path):
    """
    Ask CLIP to rank turbidity-related text prompts against your image.
    No labels needed. Just a sanity check.
    """
    tokenizer = open_clip.get_tokenizer(MODEL_NAME)
    prompts = [
        "crystal clear underwater visibility",
        "slightly hazy underwater water",
        "murky turbid underwater with poor visibility",
        "completely turbid water with zero visibility"
    ]
    tokens = tokenizer(prompts).to(DEVICE)
    img = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        img_features  = clip_model.encode_image(img)
        text_features = clip_model.encode_text(tokens)
        img_features  = img_features  / img_features.norm(dim=-1, keepdim=True)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        probs = (img_features @ text_features.T).softmax(dim=-1).squeeze()

    print("Zero-shot turbidity assessment:")
    for p, prob in zip(prompts, probs):
        print(f"  {prob:.2%}  {p}")

zero_shot_check("your_dive_image.png")   # run this before anything else


# ── STEP 1: Extract and CACHE CLIP embeddings ─────────────────────────────────
# CLIP encodes each 1920x1080 image into a 512-dim vector.
# Do this ONCE and save — no need to re-run CLIP every training epoch.

def extract_and_cache_embeddings(csv_path, images_dir, cache_path="embeddings.npz"):
    if os.path.exists(cache_path):
        print(f"Loading cached embeddings from {cache_path}")
        data = np.load(cache_path)
        return data["embeddings"], data["scores"], data["filenames"].tolist()

    df = pd.read_csv(csv_path)    # columns: filename, score
    embeddings, scores, filenames = [], [], []

    print(f"Extracting CLIP embeddings for {len(df)} images...")
    for _, row in df.iterrows():
        path = os.path.join(images_dir, row["filename"])
        img  = preprocess(Image.open(path).convert("RGB")).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            emb = clip_model.encode_image(img)
            emb = emb / emb.norm(dim=-1, keepdim=True)   # L2 normalize

        embeddings.append(emb.cpu().numpy().squeeze())
        scores.append(float(row["score"]))
        filenames.append(row["filename"])
        print(f"  ✓ {row['filename']}")

    embeddings = np.array(embeddings, dtype=np.float32)
    scores     = np.array(scores,     dtype=np.float32)
    np.savez(cache_path, embeddings=embeddings, scores=scores,
             filenames=np.array(filenames))
    print(f"Saved to {cache_path}")
    return embeddings, scores, filenames


# ── STEP 2: Tiny regression head on top of CLIP embeddings ───────────────────
# Input: 512-dim CLIP vector → Output: single score 0–100

class TurbidityHead(nn.Module):
    def __init__(self, input_dim=512):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.LayerNorm(128),           # more stable than BatchNorm for small datasets
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 32),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(32, 1),
            nn.Sigmoid()                 # output 0–1, multiply by 100 at inference
        )

    def forward(self, x):
        return self.net(x).squeeze(-1)


# ── STEP 3: Dataset ───────────────────────────────────────────────────────────

class EmbeddingDataset(Dataset):
    def __init__(self, embeddings, scores):
        self.X = torch.tensor(embeddings, dtype=torch.float32)
        self.y = torch.tensor(scores / 100.0, dtype=torch.float32)  # normalize 0–1

    def __len__(self):
        return len(self.y)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]


# ── STEP 4: Training ──────────────────────────────────────────────────────────

def train(csv_path, images_dir, epochs=300):
    embeddings, scores, _ = extract_and_cache_embeddings(csv_path, images_dir)

    X_train, X_val, y_train, y_val = train_test_split(
        embeddings, scores, test_size=0.2, random_state=42
    )

    train_ds = EmbeddingDataset(X_train, y_train)
    val_ds   = EmbeddingDataset(X_val,   y_val)

    train_loader = DataLoader(train_ds, batch_size=8,  shuffle=True)
    val_loader   = DataLoader(val_ds,   batch_size=8)

    model     = TurbidityHead().to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-3)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    loss_fn   = nn.MSELoss()

    best_val_loss, best_state = float("inf"), None

    for epoch in range(epochs):
        model.train()
        for X, y in train_loader:
            X, y = X.to(DEVICE), y.to(DEVICE)
            optimizer.zero_grad()
            loss_fn(model(X), y).backward()
            optimizer.step()
        scheduler.step()

        model.eval()
        with torch.no_grad():
            val_loss = np.mean([
                loss_fn(model(X.to(DEVICE)), y.to(DEVICE)).item()
                for X, y in val_loader
            ])

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

        if epoch % 50 == 0:
            print(f"Epoch {epoch:3d} | val error ≈ ±{np.sqrt(val_loss)*100:.1f} pts")

    model.load_state_dict(best_state)
    torch.save(model.state_dict(), "turbidity_head.pt")
    print(f"\nDone. Best val error ≈ ±{np.sqrt(best_val_loss)*100:.1f} pts out of 100")
    return model


# ── STEP 5: Inference ─────────────────────────────────────────────────────────

def score_image(image_path):
    model = TurbidityHead().to(DEVICE)
    model.load_state_dict(torch.load("turbidity_head.pt", map_location=DEVICE))
    model.eval()

    img = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        emb   = clip_model.encode_image(img)
        emb   = emb / emb.norm(dim=-1, keepdim=True)
        score = model(emb.float()).item() * 100

    return round(score, 1)


# ── Run ───────────────────────────────────────────────────────────────────────

model = train("labels.csv", "./dive_images")
print(score_image("new_dive.png"))