"""The parts of the package stay apart: the server never imports the CLI
(or any later part), so it can be reused or replaced on its own."""

import ast
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1] / "src" / "stilo" / "server"


def imported_modules(path):
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0:
            yield node.module


def test_server_imports_only_itself_from_stilo():
    for path in SERVER.rglob("*.py"):
        for module in imported_modules(path):
            if module == "stilo" or module.startswith("stilo."):
                assert module.startswith("stilo.server"), f"{path.name} imports {module}"
