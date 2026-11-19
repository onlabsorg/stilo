"""Files by their public URL: documents, other files, their types and the
safety headers (docs/protocol.md). Exported, so that another server that
speaks the protocol answers the same."""

from __future__ import annotations

import hashlib
import mimetypes
from pathlib import PurePosixPath
from urllib.parse import quote

from fastapi.responses import Response

DOCUMENT_SUFFIX = ".texl"

# The document a read of a folder, or of a packed package, leads to (S25)
INDEX = "index.texl"

# Document contents change and the editor fetches imports on every rendering:
# browsers must not reuse a stored copy without asking the server again.
NO_CACHE = {"Cache-Control": "no-cache"}

# Python's own table of types, not the machine's, so that every installation
# answers the same. WebP is missing from the table of Python 3.11.
FILE_TYPES = mimetypes.MimeTypes()
FILE_TYPES.add_type("image/webp", ".webp")


def etag(content: bytes) -> str:
    """Strong ETag of a file's content, quoted as HTTP requires."""
    return '"' + hashlib.sha256(content).hexdigest() + '"'


def is_document(path: str) -> bool:
    """Whether `path` names a Texl document (by its suffix, `.texl`)."""
    return PurePosixPath(path.strip("/") or "/").suffix == DOCUMENT_SUFFIX


def media_type(path: str) -> str:
    """The type a file that is not a document is served with, from its name;
    `application/octet-stream` when unknown or compressed."""
    guessed, encoding = FILE_TYPES.guess_type(path)
    if guessed is None or encoding is not None:
        return "application/octet-stream"
    return guessed


def download_response(path: str, content: bytes, tag: str) -> Response:
    """A file as a download (`?download`): its type, and saved under its name
    rather than shown (S25). How a packed package's own file is fetched,
    since a read of its path leads to its `index.texl`."""
    name = PurePosixPath(path.strip("/")).name
    # The plain name for old clients, ASCII only (headers are Latin-1); the
    # real one, encoded, for the others
    quoted = name.encode("ascii", "replace").decode().replace("\\", "").replace('"', "")
    disposition = f"attachment; filename=\"{quoted}\"; filename*=UTF-8''{quote(name)}"
    return Response(content, media_type=media_type(path) if not is_document(path) else "text/plain; charset=utf-8",
                    headers={"ETag": tag, "X-Content-Type-Options": "nosniff", **NO_CACHE,
                             "Content-Disposition": disposition})


def other_file_response(path: str, content: bytes, tag: str) -> Response:
    """A file that is not a Texl document, by its public URL. Files are
    untrusted: one opened by its URL must not run scripts on this origin, which
    can write to every document (docs/protocol.md)."""
    kind = media_type(path)
    headers = {"ETag": tag, "X-Content-Type-Options": "nosniff", **NO_CACHE, "Vary": "Accept"}
    if kind.endswith(("/html", "/xml", "+xml")):
        headers["Content-Security-Policy"] = "sandbox"
    return Response(content, media_type=kind, headers=headers)
