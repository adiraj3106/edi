import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
gnn_dir = os.path.join(script_dir, "agriguard_gnn_build")
if gnn_dir not in sys.path:
    sys.path.insert(0, gnn_dir)

target_script = os.path.join(gnn_dir, "train_final.py")
with open(target_script, "r", encoding="utf-8") as f:
    code = f.read()

exec(compile(code, target_script, "exec"), {"__name__": "__main__", "__file__": target_script})
