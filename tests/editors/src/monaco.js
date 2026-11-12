import * as monaco from "monaco-editor";
self.MonacoEnvironment = { getWorker: () => new Worker(URL.createObjectURL(new Blob(["self.onmessage=()=>{}"], { type: "text/javascript" }))) };
document.getElementById("ed").style.height = "160px";
const ed = monaco.editor.create(document.getElementById("ed"), { value: "", language: "plaintext", minimap: { enabled: false }, editContext: location.hash !== "#textarea" });
window.lab = { sel: "#ed", focusSel: "#ed .view-lines", buffered: true, text: () => ed.getValue(), clear: async () => { ed.setValue(""); } };
