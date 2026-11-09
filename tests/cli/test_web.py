"""`run_server`: stopping with Ctrl+C."""

import uvicorn

from stilo.cli.web import run_server


def test_ctrl_c_stops_with_a_goodbye(tmp_path, monkeypatch, capsys):
    # uvicorn re-raises Ctrl+C after its clean shutdown
    def interrupted(server):
        raise KeyboardInterrupt

    monkeypatch.setattr(uvicorn.Server, "run", interrupted)
    run_server(tmp_path, "127.0.0.1", 8000, tmp_path)
    assert capsys.readouterr().out == "Stilo: stopped. Goodbye!\n"
