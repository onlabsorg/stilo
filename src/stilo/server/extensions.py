"""Server extensions (S17, phase 5): what a package adds to the server.

A `ServerExtension` is given to `create_app()`. Its router is mounted under
`/_api/x/<id>/`, its storage wrapper wraps the storage every route uses, and
`/_api/info` lists it with its version and capabilities (docs/protocol.md).
One extension is one value, so that a later loader of installed packages
(phase 6) can take it from an entry point as it is.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Sequence

from fastapi import APIRouter, Request

from .storage import Storage

# Lowercase letters, digits and dashes (docs/protocol.md, Extensions)
EXTENSION_ID = re.compile(r"[a-z0-9][a-z0-9-]*")


@dataclass(frozen=True)
class ServerExtension:
    """A server extension: `id`, the name of its space `/_api/x/<id>/` and of
    its entry in `/_api/info`; `router`, its endpoints, mounted there;
    `wrap_storage`, given the storage, returns the one to use instead (a
    `StorageWrapper`, say); `capabilities`, what it can do, in names of its
    own; `version`, its own version."""

    id: str
    router: APIRouter | None = None
    wrap_storage: Callable[[Storage], Storage] | None = None
    capabilities: Sequence[str] = ()
    version: str | None = None

    def info(self) -> dict:
        """Its entry in `/_api/info`."""
        entry = {"id": self.id, "capabilities": list(self.capabilities)}
        if self.version is not None:
            entry["version"] = self.version
        return entry


def check_extensions(extensions: Sequence[ServerExtension]) -> None:
    """Refuse a list of extensions with a bad or repeated id, or with
    capabilities that are not strings, before anything is mounted."""
    seen = set()
    for extension in extensions:
        if not isinstance(extension, ServerExtension):
            raise TypeError(f"not a ServerExtension: {extension!r}")
        if not isinstance(extension.id, str) or not EXTENSION_ID.fullmatch(extension.id):
            raise ValueError(f"bad extension id {extension.id!r}: use lowercase letters, digits and dashes")
        if extension.id in seen:
            raise ValueError(f"two extensions with the id {extension.id!r}")
        if isinstance(extension.capabilities, str) or not all(
                isinstance(c, str) for c in extension.capabilities):
            raise ValueError(f"extension {extension.id!r}: capabilities must be a list of strings")
        seen.add(extension.id)


def get_storage(request: Request) -> Storage:
    """The storage of the app, as wrapped by the extensions: a FastAPI
    dependency for an extension's endpoints,
    `storage: Storage = Depends(get_storage)`."""
    return request.app.state.storage
