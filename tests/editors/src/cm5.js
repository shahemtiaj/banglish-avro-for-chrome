import CodeMirror from "codemirror5";
const cm = CodeMirror(document.getElementById("ed"), { value: "", lineNumbers: true, inputStyle: location.hash === "#ce" ? "contenteditable" : "textarea" });
window.lab = { sel: "#ed .CodeMirror", buffered: location.hash !== "#ce", focusSel: location.hash === "#ce" ? "#ed .CodeMirror-code" : "#ed .CodeMirror-scroll", text: () => cm.getValue(), clear: async () => { cm.setValue(""); } };
