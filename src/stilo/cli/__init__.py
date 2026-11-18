"""The `stilo` command line: one subcommand per `Command`, Stilo's own in
`COMMANDS`, then those of other packages (docs/cli.md).

The names in `__all__` are the CLI's public API, what a plugin may use;
`tests/cli/test_plugins.py` pins the list.
"""

import argparse
import sys
from importlib.metadata import entry_points

from .commands import COMMANDS, Command
from .project import create_engine
from .web import WEB_DIST, run_server

__all__ = ["Command", "COMMANDS", "main", "create_engine", "WEB_DIST", "run_server"]

# The entry-point group through which other packages add commands
PLUGIN_GROUP = "stilo.commands"


def plugin_commands(taken: set[str]) -> list[Command]:
    """The commands of installed packages, from the entry-point group
    `stilo.commands`, each entry point a `Command`, sorted by name. One that
    fails to load, is not a `Command`, or takes a name already in `taken`
    (Stilo's own commands, or a plugin's that came first) is skipped with a
    warning on standard error."""
    taken = set(taken)
    found = []
    for point in entry_points(group=PLUGIN_GROUP):
        where = f"{point.name} ({point.dist.name})" if getattr(point, "dist", None) else point.name
        try:
            command = point.load()
        except Exception as e:  # a broken plugin must not break stilo
            _skip(where, f"{type(e).__name__}: {e}")
            continue
        if not isinstance(command, Command):
            _skip(where, "not a stilo.cli.Command")
            continue
        found.append((command.name, where, command))
    plugins = []
    for name, where, command in sorted(found, key=lambda entry: (entry[0], entry[1])):
        if name in taken:
            _skip(where, f"the command {name!r} already exists")
            continue
        taken.add(name)
        plugins.append(command)
    return plugins


def _skip(where: str, reason: str) -> None:
    print(f"stilo: plugin {where} skipped: {reason}", file=sys.stderr)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="stilo", description="Edit and render a folder of linked Texl documents.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    commands = COMMANDS + plugin_commands({command.name for command in COMMANDS})
    for command in commands:
        sub = subparsers.add_parser(command.name, help=command.help)
        command.add_arguments(sub)
        sub.set_defaults(run=command.run)
    args = parser.parse_args(argv)
    return args.run(args)
