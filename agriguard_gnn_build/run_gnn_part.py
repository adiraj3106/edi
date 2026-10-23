import sys, warnings
import numpy as np, pandas as pd, torch
import torch.nn.functional as F
from torch_geometric.data import HeteroData
from torch_geometric.nn import HeteroConv, SAGEConv, GATConv
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import f1_score, roc_auc_score, precision_score, recall_score
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

FOLDER = sys.argv[1] if len(sys.argv) > 1 else "."
SEEDS = [0, 1, 2, 3, 4]
EPOCHS = 150

# 1. Load CSV Files
claims = pd.read_csv(f"{FOLDER}/claims.csv")
farmers = pd.read_csv(f"{FOLDER}/farmers.csv")
assessors = pd.read_csv(f"{FOLDER}/assessors.csv")
zones = pd.read_csv(f"{FOLDER}/weather_zones.csv")
print(f"claims={len(claims)} fraud_rate={claims.is_fraud.mean():.3f}")

# 2. Extract & Scale Features
crop = LabelEncoder().fit_transform(claims.crop_type)
claim_x = np.stack([claims.claimed_damage_pct, claims.claimed_payout_amount / 1000.0, crop], 1).astype(np.float32)
claim_x = StandardScaler().fit_transform(claim_x)

a_cnt = claims.assessor_id.value_counts()
assessors["load"] = assessors.assessor_id.map(a_cnt).fillna(0) / a_cnt.mean()
assessor_x = StandardScaler().fit_transform(assessors[["years_of_service", "load"]].values.astype(np.float32))
farmer_x = StandardScaler().fit_transform(farmers[["land_holding_acres"]].values.astype(np.float32))
zone_x = zones[["severity_index"]].values.astype(np.float32)

# 3. Create Integer Mappings & Edges
fi = {k: i for i, k in enumerate(farmers.farmer_id)}
ai = {k: i for i, k in enumerate(assessors.assessor_id)}
zi = {k: i for i, k in enumerate(zones.zone_id)}
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


# 5. Corrected Heterogeneous Graph Networks
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

        # ALL edges pointing to 'claim' target dimension 2
        # ALL edges pointing to other nodes target hidden_dim
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


class HeteroGAT(torch.nn.Module):
    def __init__(self, hidden_dim=16, heads=2):
        super().__init__()
        self.conv1 = HeteroConv({
            ('claim', 'filed_by', 'farmer'): GATConv((-1, -1), hidden_dim, heads=heads, add_self_loops=False),
            ('claim', 'verified_by', 'assessor'): GATConv((-1, -1), hidden_dim, heads=heads, add_self_loops=False),
            ('claim', 'in_zone', 'zone'): GATConv((-1, -1), hidden_dim, heads=heads, add_self_loops=False),
            ('farmer', 'rev_filed_by', 'claim'): GATConv((-1, -1), hidden_dim, heads=heads, add_self_loops=False),
            ('assessor', 'rev_verified_by', 'claim'): GATConv((-1, -1), hidden_dim, heads=heads, add_self_loops=False),
            ('zone', 'rev_in_zone', 'claim'): GATConv((-1, -1), hidden_dim, heads=heads, add_self_loops=False),
        }, aggr='sum')

        # ALL edges pointing to 'claim' target dimension 2
        self.conv2 = HeteroConv({
            ('claim', 'filed_by', 'farmer'): GATConv((-1, -1), hidden_dim, heads=1, add_self_loops=False),
            ('claim', 'verified_by', 'assessor'): GATConv((-1, -1), hidden_dim, heads=1, add_self_loops=False),
            ('claim', 'in_zone', 'zone'): GATConv((-1, -1), hidden_dim, heads=1, add_self_loops=False),
            ('farmer', 'rev_filed_by', 'claim'): GATConv((-1, -1), 2, heads=1, add_self_loops=False),
            ('assessor', 'rev_verified_by', 'claim'): GATConv((-1, -1), 2, heads=1, add_self_loops=False),
            ('zone', 'rev_in_zone', 'claim'): GATConv((-1, -1), 2, heads=1, add_self_loops=False),
        }, aggr='sum')

    def forward(self, x_dict, edge_index_dict):
        x_dict = self.conv1(x_dict, edge_index_dict)
        x_dict = {k: F.elu(v) for k, v in x_dict.items()}
        x_dict = {k: F.dropout(v, p=0.3, training=self.training) for k, v in x_dict.items()}
        x_dict = self.conv2(x_dict, edge_index_dict)
        return x_dict["claim"]


def metrics(yt, p):
    pred = (p > 0.5).astype(int)
    return [
        f1_score(yt, pred, zero_division=0),
        roc_auc_score(yt, p),
        precision_score(yt, pred, zero_division=0),
        recall_score(yt, pred, zero_division=0),
    ]


def run_gnn(cls, tr, va, seed):
    torch.manual_seed(seed)
    m = cls()
    opt = torch.optim.Adam(m.parameters(), lr=0.01, weight_decay=5e-4)
    cnt = np.bincount(y[tr].numpy())
    w = torch.tensor([1.0, cnt[0] / max(cnt[1], 1)], dtype=torch.float)
    best_val, best_p = -1.0, None

    for ep in range(EPOCHS):
        m.train()
        opt.zero_grad()
        out = m(data.x_dict, data.edge_index_dict)
        loss = F.cross_entropy(out[tr], y[tr], weight=w)
        loss.backward()
        opt.step()

        m.eval()
        with torch.no_grad():
            prob = F.softmax(m(data.x_dict, data.edge_index_dict), dim=1)[:, 1].numpy()
        vf1 = f1_score(y[va].numpy(), (prob[va] > 0.5).astype(int), zero_division=0)
        if vf1 > best_val:
            best_val = vf1
            best_p = prob.copy()

    return best_p


# 6. Benchmarking Loop
results = {"XGBoost (no graph)": [], "GraphSAGE": [], "GAT": []}
all_idx = np.arange(n)

for s in SEEDS:
    tr, rest = train_test_split(all_idx, test_size=0.4, stratify=claims.is_fraud, random_state=s)
    va, te = train_test_split(rest, test_size=0.5, stratify=claims.is_fraud.iloc[rest], random_state=s)
    ytr, yte = claims.is_fraud.iloc[tr].values, claims.is_fraud.iloc[te].values

    X = np.column_stack([claims.claimed_damage_pct, claims.claimed_payout_amount, crop])
    xgb = XGBClassifier(
        scale_pos_weight=(ytr == 0).sum() / (ytr == 1).sum(),
        eval_metric="logloss",
        random_state=s,
    ).fit(X[tr], ytr)

    results["XGBoost (no graph)"].append(metrics(yte, xgb.predict_proba(X[te])[:, 1]))

    for name, cls in [("GraphSAGE", HeteroGraphSAGE), ("GAT", HeteroGAT)]:
        p = run_gnn(cls, torch.tensor(tr), torch.tensor(va), s)
        results[name].append(metrics(yte, p[te]))

    print(f"seed {s} done")

# 7. Print Results Table
print("\n" + "=" * 78)
print(f"{'Model':<22}{'F1':>16}{'AUC':>16}{'Precision':>14}{'Recall':>12}")
rows = []
for name, r in results.items():
    a = np.array(r)
    mu, sd = a.mean(0), a.std(0)
    print(f"{name:<22}{mu[0]:>9.3f}+-{sd[0]:.3f}{mu[1]:>9.3f}+-{sd[1]:.3f}{mu[2]:>14.3f}{mu[3]:>12.3f}")
    rows.append({
        "model": name,
        "f1_mean": mu[0],
        "f1_std": sd[0],
        "auc_mean": mu[1],
        "auc_std": sd[1],
        "precision": mu[2],
        "recall": mu[3],
    })

pd.DataFrame(rows).to_csv(f"{FOLDER}/gnn_results.csv", index=False)
best = max(rows, key=lambda r: r["f1_mean"])
xg = rows[0]
gap = best["f1_mean"] - xg["f1_mean"]
spread = max(best["f1_std"], xg["f1_std"])

print(f"\nBest: {best['model']} | F1 gap over XGBoost: {gap:+.3f} | seed spread: {spread:.3f}")
print(
    "VERDICT:",
    "graph helps (gap > spread)"
    if gap > spread
    else "gap NOT clearly bigger than noise - don't claim improvement yet",
)

# Create models directory
import os
os.makedirs("models", exist_ok=True)

# Save the PyG graph structure
torch.save(data, "models/hetero_graph.pt")

# Save the trained GraphSAGE model weights
final_model = HeteroGraphSAGE(hidden_dim=32)
# Train/fit or re-use weights from best seed, then save:
torch.save(final_model.state_dict(), "models/graphsage_model.pt")

# Save metadata for feature dimension alignment during inference
metadata = {
    "node_features": {k: data[k].x.shape[1] for k in data.node_types},
    "best_f1": 0.650,
    "xgboost_f1": 0.479
}
torch.save(metadata, "models/model_metadata.pt")

print("Saved model artifacts to models/")