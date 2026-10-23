import sys
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import f1_score, roc_auc_score, precision_score, recall_score
from xgboost import XGBClassifier

FOLDER = sys.argv[1] if len(sys.argv) > 1 else "."
SEEDS = [0, 1, 2, 3, 4]

claims = pd.read_csv(f"{FOLDER}/claims.csv")
farmers = pd.read_csv(f"{FOLDER}/farmers.csv")
claims = claims.merge(farmers[["farmer_id", "family_group_id"]], on="farmer_id", how="left")
n = len(claims)
y = claims.is_fraud.values
crop = LabelEncoder().fit_transform(claims.crop_type)

# structural counts (no labels used)
for col, name in [("assessor_id", "assessor_cnt"), ("family_group_id", "family_cnt"),
                  ("zone_id", "zone_cnt"), ("farmer_id", "farmer_cnt")]:
    claims[name] = claims.groupby(col)["claim_id"].transform("count")

XA = np.column_stack([claims.claimed_damage_pct, claims.claimed_payout_amount, crop])
counts = claims[["assessor_cnt", "family_cnt", "zone_cnt", "farmer_cnt"]].values


def metrics(yt, p):
    pred = (p > 0.5).astype(int)
    return [f1_score(yt, pred, zero_division=0), roc_auc_score(yt, p),
            precision_score(yt, pred, zero_division=0), recall_score(yt, pred, zero_division=0)]


def assessor_rate(tr):
    """Assessor fraud rate from TRAIN labels only; leave-one-out for train rows."""
    g = y[tr].mean()
    s = pd.DataFrame({"a": claims.assessor_id.values[tr], "y": y[tr]}).groupby("a")["y"].agg(["sum", "count"])
    asum = claims.assessor_id.map(s["sum"]).fillna(0).values
    acnt = claims.assessor_id.map(s["count"]).fillna(0).values
    rate = np.where(acnt > 0, asum / np.maximum(acnt, 1), g)
    s_tr, c_tr = asum[tr] - y[tr], acnt[tr] - 1
    rate[tr] = np.where(c_tr > 0, s_tr / np.maximum(c_tr, 1), g)
    return rate


res = {"XGBoost A (3 features)": [], "XGBoost B (+graph features)": []}
all_idx = np.arange(n)
for s in SEEDS:
    tr, rest = train_test_split(all_idx, test_size=0.4, stratify=y, random_state=s)
    va, te = train_test_split(rest, test_size=0.5, stratify=y[rest], random_state=s)
    XB = np.column_stack([XA, counts, assessor_rate(tr)])
    for name, X in [("XGBoost A (3 features)", XA), ("XGBoost B (+graph features)", XB)]:
        m = XGBClassifier(scale_pos_weight=(y[tr] == 0).sum() / (y[tr] == 1).sum(),
                          eval_metric="logloss", random_state=s).fit(X[tr], y[tr])
        res[name].append(metrics(y[te], m.predict_proba(X[te])[:, 1]))
    print("seed", s, "done")

rows = []
print(f"\n{'Model':<30}{'F1':>16}{'AUC':>16}{'Prec':>9}{'Rec':>9}")
for name, r in res.items():
    a = np.array(r); mu, sd = a.mean(0), a.std(0)
    print(f"{name:<30}{mu[0]:>9.3f}+-{sd[0]:.3f}{mu[1]:>9.3f}+-{sd[1]:.3f}{mu[2]:>9.3f}{mu[3]:>9.3f}")
    rows.append(dict(model=name, f1_mean=mu[0], f1_std=sd[0], auc_mean=mu[1], auc_std=sd[1],
                     precision=mu[2], recall=mu[3]))
pd.DataFrame(rows).to_csv(f"{FOLDER}/fair_baseline_results.csv", index=False)

try:
    g = pd.read_csv(f"{FOLDER}/gnn_results.csv").set_index("model").loc["GraphSAGE"]
    b = rows[1]
    gap = g.f1_mean - b["f1_mean"]
    spread = max(g.f1_std, b["f1_std"])
    print(f"\nGraphSAGE F1 {g.f1_mean:.3f} vs XGBoost B {b['f1_mean']:.3f} | gap {gap:+.3f} | seed std {spread:.3f}")
    print("VERDICT:", "GraphSAGE clearly beats the fair baseline" if gap > spread
          else "gap not clearly bigger than noise: don't claim GraphSAGE is better")
except Exception as e:
    print("Could not compare with gnn_results.csv:", e)