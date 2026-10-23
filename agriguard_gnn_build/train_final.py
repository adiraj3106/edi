import os
import sys
import copy
import pickle
import warnings
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from torch_geometric.data import HeteroData
from torch_geometric.nn import HeteroConv, SAGEConv
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import f1_score, roc_auc_score, precision_score, recall_score

warnings.filterwarnings("ignore")

# 1. Resolve CSV Folder
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) > 1 and os.path.exists(os.path.join(sys.argv[1], "claims.csv")):
    FOLDER = sys.argv[1]
elif os.path.exists(os.path.join(SCRIPT_DIR, "claims.csv")):
    FOLDER = SCRIPT_DIR
elif os.path.exists("claims.csv"):
    FOLDER = "."
elif os.path.exists(os.path.join("agriguard_gnn_build", "claims.csv")):
    FOLDER = os.path.join("agriguard_gnn_build")
else:
    FOLDER = SCRIPT_DIR

print(f"Loading CSV data from: {FOLDER}")
claims = pd.read_csv(os.path.join(FOLDER, "claims.csv"))
farmers = pd.read_csv(os.path.join(FOLDER, "farmers.csv"))
assessors = pd.read_csv(os.path.join(FOLDER, "assessors.csv"))
zones = pd.read_csv(os.path.join(FOLDER, "weather_zones.csv"))

print(f"Loaded: claims={len(claims)}, farmers={len(farmers)}, assessors={len(assessors)}, zones={len(zones)}")
print(f"Fraud rate: {claims.is_fraud.mean():.3f}")

# 2. Extract & Scale Features (Identical to run_gnn_part.py)
crop_encoder = LabelEncoder()
crop = crop_encoder.fit_transform(claims.crop_type)
claim_raw = np.stack([claims.claimed_damage_pct, claims.claimed_payout_amount / 1000.0, crop], 1).astype(np.float32)
claim_scaler = StandardScaler()
claim_x = claim_scaler.fit_transform(claim_raw)

a_cnt = claims.assessor_id.value_counts()
assessors["load"] = assessors.assessor_id.map(a_cnt).fillna(0) / a_cnt.mean()
assessor_scaler = StandardScaler()
assessor_x = assessor_scaler.fit_transform(assessors[["years_of_service", "load"]].values.astype(np.float32))

farmer_scaler = StandardScaler()
farmer_x = farmer_scaler.fit_transform(farmers[["land_holding_acres"]].values.astype(np.float32))

zone_x = zones[["severity_index"]].values.astype(np.float32)

# 3. Create Integer Mappings & Edges
fi = {k: i for i, k in enumerate(farmers.farmer_id)}
ai = {k: i for i, k in enumerate(assessors.assessor_id)}
zi = {k: i for i, k in enumerate(zones.zone_id)}
ci = {k: i for i, k in enumerate(claims.claim_id)}
n = len(claims)
cidx = torch.arange(n, dtype=torch.long)

e_f = torch.stack([cidx, torch.tensor([fi[k] for k in claims.farmer_id], dtype=torch.long)])
e_a = torch.stack([cidx, torch.tensor([ai[k] for k in claims.assessor_id], dtype=torch.long)])
e_z = torch.stack([cidx, torch.tensor([zi[k] for k in claims.zone_id], dtype=torch.long)])

# 4. Assemble HeteroData
data = HeteroData()
data["claim"].x = torch.tensor(claim_x, dtype=torch.float)
data["farmer"].x = torch.tensor(farmer_x, dtype=torch.float)
data["assessor"].x = torch.tensor(assessor_x, dtype=torch.float)
data["zone"].x = torch.tensor(zone_x, dtype=torch.float)

data["claim", "filed_by", "farmer"].edge_index = e_f
data["claim", "verified_by", "assessor"].edge_index = e_a
data["claim", "in_zone", "zone"].edge_index = e_z

data["farmer", "rev_filed_by", "claim"].edge_index = e_f.flip(0)
data["assessor", "rev_verified_by", "claim"].edge_index = e_a.flip(0)
data["zone", "rev_in_zone", "claim"].edge_index = e_z.flip(0)

y = torch.tensor(claims.is_fraud.values, dtype=torch.long)


# 5. HeteroGraphSAGE Architecture (Identical to run_gnn_part.py)
class HeteroGraphSAGE(torch.nn.Module):
    def __init__(self, hidden_dim=32):
        super().__init__()
        self.conv1 = HeteroConv({
            ('claim', 'filed_by', 'farmer'): SAGEConv((-1, -1), hidden_dim),
            ('claim', 'verified_by', 'assessor'): SAGEConv((-1, -1), hidden_dim),
            ('claim', 'in_zone', 'zone'): SAGEConv((-1, -1), hidden_dim),
            ('farmer', 'rev_filed_by', 'claim'): SAGEConv((-1, -1), hidden_dim),
            ('assessor', 'rev_verified_by', 'claim'): SAGEConv((-1, -1), hidden_dim),
            ('zone', 'rev_in_zone', 'claim'): SAGEConv((-1, -1), hidden_dim),
        }, aggr='sum')

        self.conv2 = HeteroConv({
            ('claim', 'filed_by', 'farmer'): SAGEConv((-1, -1), hidden_dim),
            ('claim', 'verified_by', 'assessor'): SAGEConv((-1, -1), hidden_dim),
            ('claim', 'in_zone', 'zone'): SAGEConv((-1, -1), hidden_dim),
            ('farmer', 'rev_filed_by', 'claim'): SAGEConv((-1, -1), 2),
            ('assessor', 'rev_verified_by', 'claim'): SAGEConv((-1, -1), 2),
            ('zone', 'rev_in_zone', 'claim'): SAGEConv((-1, -1), 2),
        }, aggr='sum')

    def forward(self, x_dict, edge_index_dict):
        x_dict = self.conv1(x_dict, edge_index_dict)
        x_dict = {k: F.relu(v) for k, v in x_dict.items()}
        x_dict = {k: F.dropout(v, p=0.3, training=self.training) for k, v in x_dict.items()}
        x_dict = self.conv2(x_dict, edge_index_dict)
        return x_dict["claim"]


# 6. Stratified 80/20 Train/Validation Split
all_idx = np.arange(n)
tr, va = train_test_split(all_idx, test_size=0.20, stratify=claims.is_fraud, random_state=42)
tr_tensor = torch.tensor(tr, dtype=torch.long)
va_tensor = torch.tensor(va, dtype=torch.long)

# Same class weights as run_gnn_part.py
cnt = np.bincount(y[tr_tensor].numpy())
class_weights = torch.tensor([1.0, cnt[0] / max(cnt[1], 1)], dtype=torch.float)

# Seed & Model Initialization
torch.manual_seed(42)
np.random.seed(42)
model = HeteroGraphSAGE(hidden_dim=32)

# Initialize lazy conv layers
_ = model(data.x_dict, data.edge_index_dict)

# Same optimizer and lr as run_gnn_part.py: lr=0.01, weight_decay=5e-4
opt = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)

# 7. Training Loop (150 epochs, tracking best-F1 epoch on the 20% split)
EPOCHS = 150
best_f1 = -1.0
best_auc = 0.0
best_epoch = -1
best_state_dict = None
best_prob = None

print(f"\nTraining HeteroGraphSAGE for {EPOCHS} epochs on 80/20 stratified split...")
for ep in range(1, EPOCHS + 1):
    model.train()
    opt.zero_grad()
    out = model(data.x_dict, data.edge_index_dict)
    loss = F.cross_entropy(out[tr_tensor], y[tr_tensor], weight=class_weights)
    loss.backward()
    opt.step()

    model.eval()
    with torch.no_grad():
        logits = model(data.x_dict, data.edge_index_dict)
        prob = F.softmax(logits, dim=1)[:, 1].cpu().numpy()

    y_val = y[va_tensor].cpu().numpy()
    p_val = prob[va]
    pred_val = (p_val > 0.5).astype(int)
    vf1 = f1_score(y_val, pred_val, zero_division=0)
    vauc = roc_auc_score(y_val, p_val)

    if vf1 > best_f1:
        best_f1 = vf1
        best_auc = vauc
        best_epoch = ep
        best_state_dict = copy.deepcopy(model.state_dict())
        best_prob = prob.copy()

    if ep % 25 == 0 or ep == 1:
        print(f"Epoch {ep:3d}/{EPOCHS} | Loss: {loss.item():.4f} | Val F1: {vf1:.4f} | Val AUC: {vauc:.4f}")

# 8. Print Results on 20% Split
print("\n" + "=" * 50)
print(f"Best Validation Epoch: {best_epoch}")
print(f"Validation F1 on 20% split:  {best_f1:.4f}")
print(f"Validation AUC on 20% split: {best_auc:.4f}")
print("=" * 50)

# 9. Save Artifacts into models/
scaler_and_ids = {
    "claim_scaler": claim_scaler,
    "assessor_scaler": assessor_scaler,
    "farmer_scaler": farmer_scaler,
    "crop_encoder": crop_encoder,
    "claim_id_map": ci,
    "farmer_id_map": fi,
    "assessor_id_map": ai,
    "zone_id_map": zi,
    "scalers": {
        "claim": claim_scaler,
        "assessor": assessor_scaler,
        "farmer": farmer_scaler,
        "crop_encoder": crop_encoder,
    },
    "id_maps": {
        "claim": ci,
        "farmer": fi,
        "assessor": ai,
        "zone": zi,
    },
    "assessor_load_counts": a_cnt,
    "assessor_mean_load": float(a_cnt.mean()),
}

target_dirs = []
target_dirs.append(os.path.join(FOLDER, "models"))
target_dirs.append(os.path.join(SCRIPT_DIR, "models"))
target_dirs.append(os.path.abspath("models"))

seen = set()
unique_dirs = []
for d in target_dirs:
    norm = os.path.normpath(os.path.abspath(d))
    if norm not in seen:
        seen.add(norm)
        unique_dirs.append(norm)

for model_dir in unique_dirs:
    os.makedirs(model_dir, exist_ok=True)
    # Save trained model weights
    torch.save(best_state_dict, os.path.join(model_dir, "graphsage_model.pt"))
    # Save HeteroData PyG graph structure
    torch.save(data, os.path.join(model_dir, "hetero_graph.pt"))
    # Save scalers and mappings
    with open(os.path.join(model_dir, "scaler_and_ids.pkl"), "wb") as f:
        pickle.dump(scaler_and_ids, f)
    print(f"Saved artifacts to {model_dir}/")

if __name__ == "__main__":
    pass
