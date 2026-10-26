"""Stilo server: Texl documents on the file system, over HTTP."""

from .app import create_app

__all__ = ["create_app"]
