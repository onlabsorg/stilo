// Stilo's commands on the files and folders of the navigation pane, written
// against the services only (S17). Each takes the services and a tree node:
// the item of the menu or key, or, from the commands pane, `tree.target`.

import { isDocument } from "../api.js";
import { checkName, parentFolder, baseName } from "../core/tree.js";
import { relativeLink } from "../route.js";
import { fileIcon, folderIcon, otherFileIcon } from "../icons.js";

const NEW_DOCUMENT = (title) => `<!--{ rich }-->\n# ${title}\n`;

const documentName = (path) => baseName(path).replace(/\.texl$/, "");
const join = (folder, name) => (folder ? `${folder}/${name}` : name);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Whether `path` is the item at `item`, or inside it. */
const isIn = (path, item) => path === item || !!path?.startsWith(`${item}/`);

/** How many documents and other files are in a tree node, at any depth. */
function countFiles(node) {
    if (node.type === "file") return isDocument(node.path) ? { documents: 1, others: 0 } : { documents: 0, others: 1 };
    return (node.children ?? []).map(countFiles).reduce((a, b) => ({ documents: a.documents + b.documents, others: a.others + b.others }), { documents: 0, others: 0 });
}

/** Put text on the clipboard. The clipboard API needs a secure page, so a server
 * reached over plain HTTP needs the old way. Returns whether it worked. */
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        document.body.append(area);
        area.select();
        const copied = document.execCommand("copy");
        area.remove();
        return copied;
    }
}

const askForItem = ({ ui }) => ui.notify("Choose an item in the navigation pane first");

/** Before an operation on an item that holds the open document: offer to save
 * its unsaved changes. Returns whether to go on. */
async function saveFirst({ document, ui }, node) {
    if (!document.path || !isIn(document.path, node.path) || !document.unsaved) return true;
    if (!(await ui.confirm("The open document has unsaved changes. Save them first?"))) return false;
    await document.save();
    return !document.unsaved;
}

/** After a move: follow the item with the open document and the root, whose
 * old addresses are gone, and show it in the tree. */
async function afterMove({ router, document, tree }, from, to) {
    const follow = (path) => (isIn(path, from) ? to + path.slice(from.length) : path);
    const route = { root: follow(router.root), doc: follow(document.path) };
    const sameRoot = route.root === router.root;
    await router.replace(route);
    await tree.showInTree(sameRoot ? to : null);
}

/** Ask for a name in the tree, create the document with the text
 * `text(name)` gives, and open it. */
async function createDocument(stilo, folder, value, label, text) {
    const { tree, transport, router } = stilo;
    let path;
    const done = await tree.askName({
        folder,
        value,
        label,
        submit: async (typed) => {
            const { name, problem } = checkName(typed, folder, "file");
            if (problem) return problem;
            path = join(folder, `${name}.texl`);
            try {
                await transport.createFile(path, await text(name));
            } catch (error) {
                return error.status === 409 ? `${name} already exists here.` : error.message;
            }
        },
    });
    if (!done) return;
    await tree.refresh();
    await router.go({ root: router.root, doc: path });
}

/** Create a document in a chosen folder (`tree.folderFor`) and open it. */
export function newDocument(stilo, node) {
    return createDocument(stilo, stilo.tree.folderFor(node), "untitled", "Name of the new document", (title) => NEW_DOCUMENT(title));
}

/** Create a copy of a document, next to it, and open it. */
export async function duplicate(stilo, node) {
    if (!node) return askForItem(stilo);
    if (node.type === "folder" || !isDocument(node.path)) return stilo.ui.notify("Duplicate works on documents only");
    if (!(await saveFirst(stilo, node))) return;
    const name = documentName(node.path);
    const text = async () => (await stilo.transport.readFile(node.path)).text;
    await createDocument(stilo, parentFolder(node.path), `${name} copy`, `Name of the copy of ${name}`, text);
}

/** Create a folder in a chosen place, and make it the current item. */
export async function newFolder(stilo, node) {
    const { tree, transport } = stilo;
    const folder = tree.folderFor(node);
    let path;
    const done = await tree.askName({
        folder,
        value: "New folder",
        label: "Name of the new folder",
        icon: folderIcon,
        submit: async (typed) => {
            const { name, problem } = checkName(typed, folder, "folder");
            if (problem) return problem;
            path = join(folder, name);
            try {
                await transport.createFolder(path);
            } catch (error) {
                return error.status === 409 ? `${name} already exists here.` : error.message;
            }
        },
    });
    if (done) await tree.showInTree(path);
}

/** Choose files with the browser's dialog and add them to a folder. A file
 * whose name is taken or cannot be used is left out, and the status says so. */
export function upload(stilo, node) {
    const folder = stilo.tree.folderFor(node);
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.addEventListener("change", () => uploadFiles(stilo, folder, [...input.files]));
    input.click();
}

/** Add files to a folder; what cannot be added is reported in the status. */
export async function uploadFiles({ tree, transport, ui }, folder, files) {
    if (!files.length) return;
    const done = [];
    const skipped = [];
    ui.notify("Uploading…");
    for (const file of files) {
        const { problem } = checkName(file.name, folder, isDocument(file.name) ? "file" : "other");
        if (problem) {
            skipped.push(`${file.name} (${problem.replace(/\.$/, "").toLowerCase()})`);
            continue;
        }
        const path = join(folder, file.name);
        try {
            await transport.uploadFile(path, file);
            done.push(path);
        } catch (error) {
            skipped.push(`${file.name} (${error.status === 409 ? "already exists" : error.message})`);
        }
    }
    await tree.showInTree(done.length === 1 ? done[0] : null);
    const hidden = !tree.showOther && done.some((path) => !isDocument(path)) ? "; other files are hidden" : "";
    const uploaded = done.length ? `Uploaded ${plural(done.length, "file")} to /${folder}${hidden}` : "Nothing uploaded";
    ui.notify(skipped.length ? `${uploaded}. Not uploaded: ${skipped.join(", ")}` : uploaded);
}

/** Rename a file or a folder, in its row of the tree. */
export async function rename(stilo, node) {
    if (!node) return askForItem(stilo);
    if (!(await saveFirst(stilo, node))) return;
    const { tree, transport, ui } = stilo;
    const isFile = node.type === "file";
    const type = isFile && !isDocument(node.path) ? "other" : node.type;
    const folder = parentFolder(node.path);
    const old = type === "file" ? documentName(node.path) : baseName(node.path);
    let to;
    const done = await tree.askName({
        folder,
        replaces: node.path,
        value: old,
        label: `New name of ${old}`,
        icon: { file: fileIcon, other: otherFileIcon, folder: folderIcon }[type],
        submit: async (typed) => {
            const { name, problem } = checkName(typed, folder, type);
            if (problem) return problem;
            if (name === old) return false;
            const what = isFile ? "it" : "the files in it";
            if (!(await ui.confirm(`Links from other documents to ${what} will stop working. Rename ${old} to ${name}?`))) return false;
            to = join(folder, type === "file" ? `${name}.texl` : name);
            try {
                await transport.moveItem(node.path, to);
            } catch (error) {
                return error.status === 409 ? `${name} already exists here.` : error.message;
            }
        },
    });
    if (done) await afterMove(stilo, node.path, to);
}

/** Open the Move to… dialog for a file or a folder; the folder chosen there
 * receives it. */
export async function moveTo(stilo, node) {
    if (!node) return askForItem(stilo);
    if (!(await saveFirst(stilo, node))) return;
    const { tree, transport, ui } = stilo;
    let busy = false;
    const choose = async (folder) => {
        if (busy) return;
        busy = true;
        const to = join(folder, baseName(node.path));
        try {
            await transport.moveItem(node.path, to);
        } catch (error) {
            busy = false;
            return tree.failMove(error.status === 409 ? `${documentName(to)} already exists in that folder.` : error.message);
        }
        tree.endMove();
        await afterMove(stilo, node.path, to);
        ui.notify(`Moved to /${folder}`);
    };
    try {
        tree.startMove({ node, tree: await transport.readTree(""), choose });
    } catch (error) {
        ui.notify(error.message);
    }
}

/** Move a file, or a folder with everything in it, to the trash. */
export async function deleteItem(stilo, node) {
    if (!node) return askForItem(stilo);
    const { document, router, tree, transport, ui } = stilo;
    const isFile = node.type === "file";
    const closes = !!document.path && isIn(document.path, node.path);
    const name = isFile && isDocument(node.path) ? documentName(node.path) : baseName(node.path);
    let question = `Delete ${name}? It goes to the .trash folder.`;
    if (!isFile) {
        const { documents, others } = countFiles(node);
        const contents = [documents && plural(documents, "document"), others && plural(others, "other file")].filter(Boolean);
        question = contents.length
            ? `Delete the folder ${name} and everything in it (${contents.join(", ")})? It goes to the .trash folder.`
            : `Delete the empty folder ${name}?`;
    }
    const lost = closes && document.unsaved ? " Unsaved changes will be lost." : "";
    if (!(await ui.confirm(question + lost))) return;
    try {
        await (isFile ? transport.deleteFile(node.path) : transport.deleteFolder(node.path));
    } catch (error) {
        return ui.notify(`Not deleted: ${error.message}`);
    }
    if (closes) {
        document.discard();
        await router.replace({ root: router.root, doc: null });
    }
    await tree.refresh();
    ui.notify(`Deleted ${name}`);
}

/** Copy a file's link, relative to the open document: what `texl.import`
 * or a Markdown link or image there needs. */
export async function copyLink({ document, ui }, node) {
    if (!node) return askForItem({ ui });
    if (node.type === "folder") return ui.notify("Copy link works on files, not folders");
    const link = relativeLink(document.path, node.path);
    ui.notify((await copyText(link)) ? `Link copied: ${link}` : `Could not copy the link: ${link}`);
}

/** Make a folder, or the folder of a file, the navigation root. */
export function openAsRoot(stilo, node) {
    if (!node) return askForItem(stilo);
    return stilo.router.go({ root: node.type === "folder" ? node.path : parentFolder(node.path), doc: stilo.document.path });
}
