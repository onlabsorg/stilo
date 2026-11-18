"""CLI commands from other packages: the entry-point group `stilo.commands`,
and the CLI's public API, `stilo.cli.__all__`."""

from types import SimpleNamespace

import pytest

import stilo.cli
from stilo.cli import COMMANDS, Command, main


class FakeEntryPoint:
    """What `importlib.metadata.entry_points` gives: a name, a distribution and
    `load()`."""

    def __init__(self, name, value, dist="stilo-fake"):
        self.name, self._value, self.dist = name, value, SimpleNamespace(name=dist)

    def load(self):
        if isinstance(self._value, Exception):
            raise self._value
        return self._value


@pytest.fixture
def plugins(monkeypatch):
    """Sets the entry points `stilo` finds in the group `stilo.commands`."""
    installed = []

    def entry_points(group):
        assert group == "stilo.commands"
        return list(installed)

    monkeypatch.setattr(stilo.cli, "entry_points", entry_points)
    return installed


def hello_command(name="hello", help="say hello"):
    def arguments(parser):
        parser.add_argument("who")

    def run(args):
        print(f"hello {args.who}")
        return 3

    return Command(name, help, arguments, run)


def test_a_plugin_command_runs(plugins, capsys):
    plugins.append(FakeEntryPoint("hello", hello_command()))
    assert main(["hello", "world"]) == 3
    assert capsys.readouterr().out == "hello world\n"


def test_help_lists_plugin_commands_after_stilos_own(plugins, capsys):
    plugins.append(FakeEntryPoint("zz", hello_command("zz", "the last one")))
    plugins.append(FakeEntryPoint("aa", hello_command("aa", "the first plugin")))
    with pytest.raises(SystemExit):
        main(["--help"])
    out = capsys.readouterr().out
    names = [c.name for c in COMMANDS] + ["aa", "zz"]
    positions = [out.index(f"    {name} ") for name in names]
    assert positions == sorted(positions)
    assert "the first plugin" in out and "the last one" in out


def test_stilos_own_commands_win_a_name_clash(plugins, capsys):
    plugins.append(FakeEntryPoint("render", hello_command("render"), dist="stilo-evil"))
    with pytest.raises(SystemExit):
        main(["render", "--help"])
    captured = capsys.readouterr()
    assert "stilo: plugin render (stilo-evil) skipped: the command 'render' already exists" in captured.err
    assert "document to render" in captured.out


def test_between_plugins_the_first_by_distribution_wins(plugins, capsys):
    plugins.append(FakeEntryPoint("hello", hello_command(), dist="stilo-b"))
    plugins.append(FakeEntryPoint("hello", hello_command(), dist="stilo-a"))
    assert main(["hello", "x"]) == 3
    assert "plugin hello (stilo-b) skipped" in capsys.readouterr().err


def test_broken_plugins_are_skipped_with_a_warning(plugins, capsys):
    plugins.append(FakeEntryPoint("broken", ImportError("no module named stilo_broken")))
    plugins.append(FakeEntryPoint("wrong", object()))
    plugins.append(FakeEntryPoint("hello", hello_command()))
    assert main(["hello", "x"]) == 3
    err = capsys.readouterr().err
    assert "stilo: plugin broken (stilo-fake) skipped: ImportError: no module named stilo_broken" in err
    assert "stilo: plugin wrong (stilo-fake) skipped: not a stilo.cli.Command" in err


def test_without_plugins_nothing_changes(plugins, capsys):
    with pytest.raises(SystemExit):
        main(["--help"])
    captured = capsys.readouterr()
    assert captured.err == ""
    for command in COMMANDS:
        assert command.name in captured.out


def test_the_public_names():
    assert set(stilo.cli.__all__) == {"Command", "COMMANDS", "main", "create_engine", "WEB_DIST", "run_server"}
    for name in stilo.cli.__all__:
        assert hasattr(stilo.cli, name), name
