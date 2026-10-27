"""The `stilo` command line: one subcommand per entry in `COMMANDS`."""

import argparse

from .commands import COMMANDS


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="stilo", description="Edit and render a folder of linked Texl documents.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in COMMANDS:
        sub = subparsers.add_parser(command.name, help=command.help)
        command.add_arguments(sub)
        sub.set_defaults(run=command.run)
    args = parser.parse_args(argv)
    return args.run(args)

