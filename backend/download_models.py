"""
Download and convert pre-trained models for SignSense.

1. Fingerspelling: sid220/asl-now-fingerspelling (Keras .h5 -> PyTorch .pt)
   - Input: 21 landmarks * 3 = 63 floats
   - Output: 26 classes (A-Z)
   - MIT License

2. Pose-TGCN: dxli94/WLASL pretrained weights (for dynamic signs)
   - Downloads from Google Drive
   - C-UDA License (academic use)
"""

import os
import sys
import urllib.request
import shutil

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ──────────────────────────────────────────────────
# 1. Download the Keras fingerspelling model
# ──────────────────────────────────────────────────
def download_fingerspelling():
    """Download asl-now-weights.h5 from HuggingFace and convert to PyTorch."""
    h5_url = "https://huggingface.co/sid220/asl-now-fingerspelling/resolve/main/asl-now-weights.h5"
    keras_url = "https://huggingface.co/sid220/asl-now-fingerspelling/resolve/main/asl-now.keras"
    h5_path = os.path.join(MODELS_DIR, "asl-now-weights.h5")
    keras_path = os.path.join(MODELS_DIR, "asl-now.keras")
    pt_path = os.path.join(MODELS_DIR, "fingerspelling.pt")

    if os.path.exists(pt_path):
        print(f"  [SKIP] {pt_path} already exists.")
        return

    # Download the .keras file (full model with architecture)
    if not os.path.exists(keras_path):
        print(f"  Downloading {keras_url} ...")
        urllib.request.urlretrieve(keras_url, keras_path)
        print(f"  Saved to {keras_path} ({os.path.getsize(keras_path)} bytes)")

    # Download the .h5 weights as backup
    if not os.path.exists(h5_path):
        print(f"  Downloading {h5_url} ...")
        urllib.request.urlretrieve(h5_url, h5_path)
        print(f"  Saved to {h5_path} ({os.path.getsize(h5_path)} bytes)")

    # Convert Keras -> PyTorch
    try:
        convert_keras_to_pytorch(keras_path, h5_path, pt_path)
    except Exception as e:
        print(f"  [WARN] Conversion failed: {e}")
        print(f"  The Keras weights are downloaded. You can convert manually.")
        print(f"  Alternatively, the cosine-similarity fallback will be used.")


def convert_keras_to_pytorch(keras_path, h5_path, pt_path):
    """Convert the Keras model to a PyTorch state dict."""
    import numpy as np

    # Try loading with tensorflow/keras
    try:
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        import tensorflow as tf
        
        # Try loading the full .keras model first
        try:
            model = tf.keras.models.load_model(keras_path)
        except Exception:
            # Fall back to building architecture + loading weights
            model = tf.keras.Sequential([
                tf.keras.layers.Dense(256, activation='relu', input_shape=(63,)),
                tf.keras.layers.BatchNormalization(),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Dense(128, activation='relu'),
                tf.keras.layers.BatchNormalization(),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Dense(26, activation='softmax'),
            ])
            model.build((None, 63))
            model.load_weights(h5_path)

        # Extract weights layer by layer
        weights = []
        for layer in model.layers:
            layer_weights = layer.get_weights()
            if layer_weights:
                weights.append(layer_weights)

        print(f"  Extracted {len(weights)} weight groups from Keras model")
        
        # Map to PyTorch state dict
        import torch
        state_dict = {}
        
        # The Keras model architecture:
        # Dense(256) -> BN(256) -> Dropout -> Dense(128) -> BN(128) -> Dropout -> Dense(26)
        #
        # Maps to PyTorch:
        # net.0 = Linear(63, 256)     -> weight, bias
        # net.1 = BatchNorm1d(256)    -> weight, bias, running_mean, running_var
        # net.2 = ReLU
        # net.3 = Dropout
        # net.4 = Linear(256, 128)    -> weight, bias
        # net.5 = BatchNorm1d(128)    -> weight, bias, running_mean, running_var
        # net.6 = ReLU
        # net.7 = Dropout
        # net.8 = Linear(128, 26)     -> weight, bias
        
        layer_idx = 0
        pt_layer_map = [
            ("net.0", "linear"),    # Dense(256)
            ("net.1", "bn"),        # BatchNorm(256)
            ("net.4", "linear"),    # Dense(128)
            ("net.5", "bn"),        # BatchNorm(128)
            ("net.8", "linear"),    # Dense(26)
        ]
        
        for weight_group, (pt_name, layer_type) in zip(weights, pt_layer_map):
            if layer_type == "linear":
                # Keras Dense: [weight, bias], weight shape is (in, out)
                # PyTorch Linear: weight shape is (out, in)
                w = np.array(weight_group[0])
                b = np.array(weight_group[1])
                state_dict[f"{pt_name}.weight"] = torch.tensor(w.T, dtype=torch.float32)
                state_dict[f"{pt_name}.bias"] = torch.tensor(b, dtype=torch.float32)
            elif layer_type == "bn":
                # Keras BN: [gamma, beta, moving_mean, moving_variance]
                gamma = np.array(weight_group[0])
                beta = np.array(weight_group[1])
                mean = np.array(weight_group[2]) if len(weight_group) > 2 else np.zeros_like(gamma)
                var = np.array(weight_group[3]) if len(weight_group) > 3 else np.ones_like(gamma)
                state_dict[f"{pt_name}.weight"] = torch.tensor(gamma, dtype=torch.float32)
                state_dict[f"{pt_name}.bias"] = torch.tensor(beta, dtype=torch.float32)
                state_dict[f"{pt_name}.running_mean"] = torch.tensor(mean, dtype=torch.float32)
                state_dict[f"{pt_name}.running_var"] = torch.tensor(var, dtype=torch.float32)
                state_dict[f"{pt_name}.num_batches_tracked"] = torch.tensor(0, dtype=torch.long)

        torch.save(state_dict, pt_path)
        print(f"  [OK] Converted to {pt_path}")
        print(f"  State dict keys: {list(state_dict.keys())}")
        
    except ImportError:
        print("  [WARN] TensorFlow not installed. Cannot auto-convert.")
        print("  Install with: pip install tensorflow")
        print("  Or convert the .h5 weights manually.")
        
        # Create a randomly initialized model as placeholder
        import torch
        from recognition import FingerspellingMLP
        model = FingerspellingMLP(input_dim=63, num_classes=26)
        torch.save(model.state_dict(), pt_path)
        print(f"  [PLACEHOLDER] Saved randomly-initialized weights to {pt_path}")
        print(f"  Replace with converted weights for real accuracy.")


# ──────────────────────────────────────────────────
# 2. Info about Pose-TGCN (manual download required)
# ──────────────────────────────────────────────────
def print_tgcn_info():
    """Print instructions for downloading Pose-TGCN weights."""
    print("\n--- Pose-TGCN (Dynamic Signs) ---")
    print("  The WLASL Pose-TGCN pretrained weights are hosted on Google Drive.")
    print("  Manual download required:")
    print("  1. Pre-trained models: https://drive.google.com/file/d/1dzvocsaylRsjqaY4r_lyRihPZn0I6AA_/view")
    print("  2. Body keypoints: https://drive.google.com/file/d/1k5mfrc2g4ZEzzNjW6CEVjLvNTZcmPanB/view")
    print("  3. Splits file: https://drive.google.com/file/d/16CWkbMLyEbdBkrxAPaxSXFP_aSxKzNN4/view")
    print(f"  Place the unzipped model in: {os.path.join(MODELS_DIR, 'pose_tgcn.pt')}")
    print("  License: C-UDA (academic use only)")


if __name__ == "__main__":
    print("=== SignSense Model Downloader ===\n")
    
    print("--- Fingerspelling Model (A-Z) ---")
    download_fingerspelling()
    
    print_tgcn_info()
    
    print("\nDone.")
