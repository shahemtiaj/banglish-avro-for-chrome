import { Editor } from "@tiptap/core"; import StarterKit from "@tiptap/starter-kit";
const sent = [];
const editor = new Editor({ element: document.getElementById("ed"), extensions: [StarterKit],
  editorProps: { handleKeyDown(view, ev) { if (location.hash === "#chat" && ev.key === "Enter" && !ev.shiftKey) { sent.push(editor.getText()); editor.commands.clearContent(); return true; } return false; } } });
window.lab = { sel: "#ed .ProseMirror", text: () => editor.getText({ blockSeparator: "\n" }), sent: () => sent, clear: async () => { editor.commands.clearContent(); } };
