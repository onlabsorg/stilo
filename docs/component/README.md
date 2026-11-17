# The editor component

The editor at the center of Stilo's window is a web component of its own,
`<texl-editor>`. It shows one document as a sheet of cells, lets the user
edit it, renders it live, and gives the text back. Everything around it,
the navigation, the panes, loading and saving, belongs to the web app.

So you can use the editor in another web page or app, with your own storage:

```html
<texl-editor id="editor" url="https://example.com/docs/report.texl"></texl-editor>
<script type="module">
    import "@onlabsorg/stilo-web/editor";

    const editor = document.getElementById("editor");
    editor.value = await (await fetch(editor.url)).text();
    editor.addEventListener("change", () => console.log(editor.value));
</script>
```

You can also teach it new kinds of cells: a cell type is a class that turns
the user's input into Texl and back.

- [Embedding the editor](guide.md) is a tutorial: from an empty folder to an
  app that loads, edits and saves documents, shows comments, and has a cell
  type of its own.
- [API reference](api.md) lists every property, event, class and function.

The editor is published on npm with Stilo's web app, as the entry point
`@onlabsorg/stilo-web/editor` of the package `@onlabsorg/stilo-web`
(`npm install @onlabsorg/stilo-web`); in Stilo's source code it is the
folder `web/src/editor/`. For how it works inside, see
[The editor](../editor.md).
