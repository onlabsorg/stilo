"""Stilo server: Texl documents over HTTP (docs/server.md).

The names below are the server's public API: what a server extension, a
storage of another kind or another server that speaks the protocol may use.
`tests/server/test_public_api.py` pins the list; a change to it is
deliberate.
"""

from .app import CAPABILITIES, PROTOCOL, VERSION, create_app
from .extensions import ServerExtension, get_storage
from .files import (DOCUMENT_SUFFIX, FILE_TYPES, NO_CACHE, etag, is_document, media_type,
                    other_file_response)
from .home import HOME, MANIFEST, MAX_HOMES, HomeCycle, expand_home, has_home, home_of
from .storage import (BadRequest, Conflict, FolderStorage, Forbidden, NotFound,
                      PreconditionFailed, Storage, StorageError, StorageWrapper)

__all__ = [
    # The app
    "create_app", "PROTOCOL", "VERSION", "CAPABILITIES",
    # Server extensions
    "ServerExtension", "get_storage",
    # Storages
    "Storage", "FolderStorage", "StorageWrapper",
    # Errors a storage raises, with their HTTP status
    "StorageError", "BadRequest", "Forbidden", "NotFound", "Conflict", "PreconditionFailed",
    # Files by their public URL
    "DOCUMENT_SUFFIX", "is_document", "etag", "FILE_TYPES", "media_type",
    "other_file_response", "NO_CACHE",
    # The project home, `~` in paths
    "MANIFEST", "HOME", "MAX_HOMES", "HomeCycle", "home_of", "expand_home", "has_home",
]
