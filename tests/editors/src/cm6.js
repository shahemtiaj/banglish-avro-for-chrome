import { EditorView, basicSetup } from "codemirror";
const view = new EditorView({ doc: "", extensions: [basicSetup], parent: document.getElementById("ed") });
window.lab = { sel: "#ed .cm-content", text: () => view.state.doc.toString(), clear: async () => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } }); } };
