import importlib.util
import json
from pathlib import Path


def test_initialization_starts_empty_and_preserves_operator_data(tmp_path):
    script = Path(__file__).resolve().parents[3] / "scripts" / "init_local_data.py"
    spec = importlib.util.spec_from_file_location("init_local_data", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    path = module.initialize(tmp_path)
    payload = json.loads(path.read_text())
    assert payload["documents"] == payload["tenders"] == payload["chunks"] == []
    private_content = '{"operator_owned": true}\n'
    path.write_text(private_content)
    module.initialize(tmp_path)
    assert path.read_text() == private_content
