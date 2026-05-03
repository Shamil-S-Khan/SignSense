"""
Generate synthetic reference trajectories for ASL fingerspelling A-Y.

These are approximations based on canonical MediaPipe landmark positions.
They serve as a baseline until real user recordings replace them.

Each reference is saved as a numpy array of shape (10, 63):
  10 frames of 21 landmarks * 3 axes.
  For static signs, all 10 frames are identical (no movement).
"""

import numpy as np
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "references")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Canonical landmark templates (21 landmarks * [x, y, z])
# These are approximate normalized positions after wrist-centering.
# Wrist is at origin [0, 0, 0].

def make_fist():
    """All fingers curled, thumb against side."""
    lm = np.zeros(63)
    # Wrist at origin
    # Thumb: slightly out to the side
    lm[3:6] = [0.05, -0.03, 0.01]   # CMC
    lm[6:9] = [0.07, -0.05, 0.02]   # MCP
    lm[9:12] = [0.06, -0.04, 0.01]  # IP
    lm[12:15] = [0.05, -0.03, 0.01] # TIP
    # Index finger curled
    lm[15:18] = [0.03, -0.08, 0.0]  # MCP
    lm[18:21] = [0.03, -0.06, -0.02] # PIP
    lm[21:24] = [0.03, -0.04, -0.01] # DIP
    lm[24:27] = [0.03, -0.03, 0.0]   # TIP
    # Middle finger curled
    lm[27:30] = [0.01, -0.08, 0.0]
    lm[30:33] = [0.01, -0.06, -0.02]
    lm[33:36] = [0.01, -0.04, -0.01]
    lm[36:39] = [0.01, -0.03, 0.0]
    # Ring finger curled
    lm[39:42] = [-0.01, -0.08, 0.0]
    lm[42:45] = [-0.01, -0.06, -0.02]
    lm[45:48] = [-0.01, -0.04, -0.01]
    lm[48:51] = [-0.01, -0.03, 0.0]
    # Pinky curled
    lm[51:54] = [-0.03, -0.07, 0.0]
    lm[54:57] = [-0.03, -0.05, -0.02]
    lm[57:60] = [-0.03, -0.04, -0.01]
    lm[60:63] = [-0.03, -0.03, 0.0]
    return lm

def make_open_hand():
    """All fingers straight up, palm facing viewer."""
    lm = np.zeros(63)
    # Thumb extended out
    lm[3:6] = [0.06, -0.03, 0.01]
    lm[6:9] = [0.09, -0.06, 0.01]
    lm[9:12] = [0.11, -0.09, 0.01]
    lm[12:15] = [0.12, -0.11, 0.01]
    # Index straight up
    lm[15:18] = [0.03, -0.10, 0.0]
    lm[18:21] = [0.03, -0.14, 0.0]
    lm[21:24] = [0.03, -0.17, 0.0]
    lm[24:27] = [0.03, -0.20, 0.0]
    # Middle straight up
    lm[27:30] = [0.01, -0.10, 0.0]
    lm[30:33] = [0.01, -0.15, 0.0]
    lm[33:36] = [0.01, -0.18, 0.0]
    lm[36:39] = [0.01, -0.21, 0.0]
    # Ring straight up
    lm[39:42] = [-0.01, -0.10, 0.0]
    lm[42:45] = [-0.01, -0.14, 0.0]
    lm[45:48] = [-0.01, -0.17, 0.0]
    lm[48:51] = [-0.01, -0.20, 0.0]
    # Pinky straight up
    lm[51:54] = [-0.03, -0.09, 0.0]
    lm[54:57] = [-0.03, -0.13, 0.0]
    lm[57:60] = [-0.03, -0.16, 0.0]
    lm[60:63] = [-0.03, -0.19, 0.0]
    return lm

def modify_for_letter(base, letter):
    """Apply letter-specific modifications to a base template."""
    lm = base.copy()
    
    if letter == "A":
        return make_fist()  # thumb out, fingers curled
    
    elif letter == "B":
        lm = make_open_hand()
        # Thumb curled across palm
        lm[9:12] = [0.04, -0.04, -0.01]
        lm[12:15] = [0.03, -0.03, -0.01]
        return lm
    
    elif letter == "C":
        lm = make_open_hand()
        # All fingers half-curled into C shape
        for i in range(5):
            base_idx = i * 12 + 3
            for j in range(4):
                idx = base_idx + j * 3
                lm[idx + 1] *= 0.7  # reduce height
                lm[idx + 2] -= 0.02  # curve inward
        return lm
    
    elif letter == "D":
        lm = make_fist()
        # Index finger straight up
        lm[15:18] = [0.03, -0.10, 0.0]
        lm[18:21] = [0.03, -0.14, 0.0]
        lm[21:24] = [0.03, -0.17, 0.0]
        lm[24:27] = [0.03, -0.20, 0.0]
        return lm
    
    elif letter in ("E", "S", "M", "N", "T"):
        return make_fist()  # All fist variants
    
    elif letter == "F":
        lm = make_open_hand()
        # Index curled to touch thumb
        lm[18:21] = [0.05, -0.06, -0.02]
        lm[21:24] = [0.06, -0.05, -0.01]
        lm[24:27] = [0.07, -0.04, 0.0]
        return lm
    
    elif letter == "G":
        lm = make_fist()
        # Index pointing sideways
        lm[15:18] = [0.05, -0.08, 0.0]
        lm[18:21] = [0.10, -0.08, 0.0]
        lm[21:24] = [0.14, -0.08, 0.0]
        lm[24:27] = [0.17, -0.08, 0.0]
        return lm
    
    elif letter == "H":
        lm = make_fist()
        # Index + middle pointing sideways
        lm[15:18] = [0.05, -0.08, 0.0]
        lm[18:21] = [0.10, -0.08, 0.0]
        lm[21:24] = [0.14, -0.08, 0.0]
        lm[24:27] = [0.17, -0.08, 0.0]
        lm[27:30] = [0.04, -0.08, 0.0]
        lm[30:33] = [0.09, -0.08, -0.01]
        lm[33:36] = [0.13, -0.08, -0.01]
        lm[36:39] = [0.16, -0.08, -0.01]
        return lm
    
    elif letter == "I":
        lm = make_fist()
        # Pinky straight up
        lm[51:54] = [-0.03, -0.09, 0.0]
        lm[54:57] = [-0.03, -0.13, 0.0]
        lm[57:60] = [-0.03, -0.16, 0.0]
        lm[60:63] = [-0.03, -0.19, 0.0]
        return lm
    
    elif letter == "K":
        lm = make_fist()
        # Index + middle up, thumb between
        lm[15:18] = [0.03, -0.10, 0.0]
        lm[18:21] = [0.03, -0.14, 0.0]
        lm[21:24] = [0.03, -0.17, 0.0]
        lm[24:27] = [0.03, -0.20, 0.0]
        lm[27:30] = [0.01, -0.10, 0.0]
        lm[30:33] = [0.01, -0.14, 0.0]
        lm[33:36] = [0.01, -0.17, 0.0]
        lm[36:39] = [0.01, -0.20, 0.0]
        lm[9:12] = [0.06, -0.09, 0.01]
        lm[12:15] = [0.07, -0.12, 0.01]
        return lm
    
    elif letter == "L":
        lm = make_fist()
        # Index up, thumb out horizontal
        lm[15:18] = [0.03, -0.10, 0.0]
        lm[18:21] = [0.03, -0.14, 0.0]
        lm[21:24] = [0.03, -0.17, 0.0]
        lm[24:27] = [0.03, -0.20, 0.0]
        lm[6:9] = [0.08, -0.03, 0.01]
        lm[9:12] = [0.12, -0.03, 0.01]
        lm[12:15] = [0.15, -0.03, 0.01]
        return lm
    
    elif letter == "O":
        # All fingertips touch thumb
        lm = make_open_hand()
        for i in range(1, 5):
            tip_idx = i * 12 + 12 + 3
            if tip_idx + 2 < 63:
                lm[tip_idx:tip_idx+3] = [0.06, -0.06, 0.0]
        return lm
    
    elif letter == "U":
        lm = make_fist()
        # Index + middle straight up, together
        lm[15:18] = [0.03, -0.10, 0.0]
        lm[18:21] = [0.03, -0.14, 0.0]
        lm[21:24] = [0.03, -0.17, 0.0]
        lm[24:27] = [0.03, -0.20, 0.0]
        lm[27:30] = [0.01, -0.10, 0.0]
        lm[30:33] = [0.01, -0.14, 0.0]
        lm[33:36] = [0.01, -0.17, 0.0]
        lm[36:39] = [0.01, -0.21, 0.0]
        return lm
    
    elif letter == "V":
        lm = make_fist()
        # Index + middle spread (peace sign)
        lm[15:18] = [0.04, -0.10, 0.0]
        lm[18:21] = [0.05, -0.14, 0.0]
        lm[21:24] = [0.06, -0.17, 0.0]
        lm[24:27] = [0.07, -0.20, 0.0]
        lm[27:30] = [-0.01, -0.10, 0.0]
        lm[30:33] = [-0.02, -0.14, 0.0]
        lm[33:36] = [-0.03, -0.17, 0.0]
        lm[36:39] = [-0.04, -0.20, 0.0]
        return lm
    
    elif letter == "W":
        lm = make_fist()
        # Index + middle + ring up
        for offset, x_off in [(15, 0.04), (27, 0.01), (39, -0.02)]:
            lm[offset:offset+3] = [x_off, -0.10, 0.0]
            lm[offset+3:offset+6] = [x_off, -0.14, 0.0]
            lm[offset+6:offset+9] = [x_off, -0.17, 0.0]
            lm[offset+9:offset+12] = [x_off, -0.20, 0.0]
        return lm
    
    elif letter == "X":
        lm = make_fist()
        # Index half-curled (hook)
        lm[15:18] = [0.03, -0.10, 0.0]
        lm[18:21] = [0.04, -0.12, -0.02]
        lm[21:24] = [0.03, -0.10, -0.03]
        lm[24:27] = [0.02, -0.08, -0.02]
        return lm
    
    elif letter == "Y":
        lm = make_fist()
        # Thumb + pinky out
        lm[6:9] = [0.08, -0.03, 0.01]
        lm[9:12] = [0.12, -0.03, 0.01]
        lm[12:15] = [0.15, -0.03, 0.01]
        lm[51:54] = [-0.03, -0.09, 0.0]
        lm[54:57] = [-0.03, -0.13, 0.0]
        lm[57:60] = [-0.03, -0.16, 0.0]
        lm[60:63] = [-0.03, -0.19, 0.0]
        return lm
    
    else:
        return make_fist()  # Default fallback


# Generate for each letter
LETTERS = list("ABCDEFGHIKLMNOPQRSTUVWXY")
base = np.zeros(63)

for letter in LETTERS:
    single_frame = modify_for_letter(base, letter)
    # Repeat into 10 frames (static sign = same frame repeated)
    ref = np.tile(single_frame, (10, 1))
    path = os.path.join(OUTPUT_DIR, f"{letter}.npy")
    np.save(path, ref)
    print(f"  OK {letter}.npy  shape={ref.shape}")

print(f"\nDone. Generated {len(LETTERS)} references in {OUTPUT_DIR}")
