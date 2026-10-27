# stilo serve

```text
stilo serve [folder] [--host HOST] [--port PORT] [--web WEB]
```

Serves a folder of Texl documents, and the web editor that edits them, over
HTTP.

```sh
stilo serve ~/reports
```

```text
Stilo: serving /home/ada/reports at http://127.0.0.1:8000/
```

Open the address in your browser to see the folder in the editor. Press
Ctrl+C in the terminal to stop the server.

## Arguments and options

| Argument      | Default          | Meaning                                         |
|---------------|------------------|-------------------------------------------------|
| `folder`      | the current folder | The folder of the documents. It is the root of the server: everything under it can be read, and its `.texl` files can be written. |
| `--host HOST` | `127.0.0.1`      | The address to listen on. The default accepts connections from your own computer only. |
| `--port PORT` | `8000`           | The port to listen on.                          |
| `--web WEB`   | `web/dist` in the source code | The built web editor. Change it only to serve another build of it. |

## Addresses

Every document has one address: its path in the folder. With the server
above, `~/reports/projects/beam.texl` is at:

```text
http://127.0.0.1:8000/projects/beam.texl
```

- In a browser, the address opens the document in the editor.
- For a Texl import, the same address gives the file itself. This is how
  one document imports another: `texl.import("../library/steel.texl")`
  in `projects/beam.texl` reads `library/steel.texl` from the server.

The editor's navigation pane shows the whole folder. Add `?root=` to an
address to show only a part of it:

```text
http://127.0.0.1:8000/projects/beam.texl?root=projects
```

## What is served

- Only `.texl` files are listed in the navigation pane, and only they can be
  created and saved. Other files in the folder (images, data) can be read,
  for example by an import.
- Hidden files and folders (names starting with `.`) are never served.
- Names starting with `_` are reserved at the top of the folder (the server
  uses `/_api` and `/_app`): files and folders with such names there are
  not served.
- Symbolic links that lead out of the folder are not followed.

The [Protocol](../protocol.md) chapter describes every request the server
answers.

## Serving to other computers

The server has no accounts and no passwords: anybody who can reach it can
read and change every document in the folder. `--host 0.0.0.0` makes it
reachable from your network; do that only on a network you trust, or put
the server behind your own access control (a VPN, or a proxy that asks for
a password).

```sh
stilo serve ~/reports --host 0.0.0.0 --port 8080
```
