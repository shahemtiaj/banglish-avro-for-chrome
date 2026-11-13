import Quill from "quill";
const q = new Quill("#ed", {});
window.lab = { sel: "#ed .ql-editor", text: () => q.getText().replace(/\n$/, ""), clear: async () => { q.setText(""); } };
