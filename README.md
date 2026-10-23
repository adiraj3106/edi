# AgriGuard — PMFBY Crop Insurance Fraud Risk Analytics

AgriGuard is an agricultural insurance fraud detection and risk analytics platform designed for the Pradhan Mantri Fasal Bima Yojana (PMFBY) crop insurance scheme in Maharashtra, India. The system detects organized fraud syndicates, collusion rings, and synthetic claims by deploying a Heterogeneous Graph Neural Network (HeteroGraphSAGE) across relational networks connecting claims, farmers, loss adjusters/assessors, and weather risk zones. Powered by a high-performance FastAPI backend delivering calibrated risk scores and network topology subgraphs alongside an interactive React/TypeScript dashboard, AgriGuard enables special investigation units (SIUs) to prioritize suspicious claims, trace assessor-farmer collusion loops, and expedite legitimate farmer indemnity payouts formatted in Indian Rupees (₹).

---

## Getting Started

Follow the exact commands below in sequential order to set up, train, score, and run the complete AgriGuard platform:

### 1. Install Dependencies

Install the required Python machine learning and backend packages, followed by the frontend Node dependencies:

```bash
# Python dependencies (PyTorch, PyG, FastAPI, Uvicorn, Scikit-learn, XGBoost, Pandas, Numpy)
pip install -r requirements.txt

# Frontend dependencies
npm install
```

### 2. Run `train_final.py`

Train the HeteroGraphSAGE model for 150 epochs on the 80/20 stratified split, evaluate validation F1 and AUC, and export model artifacts to `models/`:

```bash
python agriguard_gnn_build/train_final.py
```

### 3. Run `score_all.py`

Generate model risk scores, triage tiers, and GNN graph explainability notes for all claims:

```bash
python agriguard_gnn_build/score_all.py
```

### 4. Start the Backend

Launch the FastAPI REST API server at `http://localhost:8000`:

```bash
uvicorn backend.main:app --reload --port 8000
```

*(Interactive Swagger API documentation will be available at `http://localhost:8000/docs`)*

### 5. Start the Frontend

Start the Vite development server to launch the analyst dashboard at `http://localhost:5173`:

```bash
npm run dev
```

---

## Limitations

- **Synthetic Data**: All claims, farmers, assessors, weather zones, and ground-truth fraud labels are entirely synthetic and generated from the project's data synthesis engine; no live PMFBY policyholder data is used.
- **Single Real Model (GNN Pillar)**: Only the graph-based Graph Neural Network (GNN) pillar is currently backed by a trained machine learning model (`HeteroGraphSAGE`).
- **NLP & Computer Vision Future Work**: The Natural Language Processing (NLP text mismatch analysis between adjuster narratives and satellite bulletins) and Computer Vision (CV image forensics, EXIF verification, and ELA tampering detection) pillars represent future work and are currently designated as "Not yet available" / "Not yet implemented".
- **Tabular XGBoost Baseline**: The baseline XGBoost model operates solely on tabular, non-graph claim attributes (`claimed_damage_pct`, `claimed_payout_amount`, and `crop_type`) without incorporating relational topology or network neighborhood features.
