import { createEditor, $getRoot, KEY_ENTER_COMMAND, COMMAND_PRIORITY_HIGH } from "lexical";
import { registerRichText } from "@lexical/rich-text";
import { registerHistory, createEmptyHistoryState } from "@lexical/history";
const el = document.getElementById("ed");
const editor = createEditor({ namespace: "lab", onError: (e) => { console.error(e); } });
editor.setRootElement(el);
registerRichText(editor);
registerHistory(editor, createEmptyHistoryState(), 300);
const sent = [];
if (location.hash === "#chat") {
  editor.registerCommand(KEY_ENTER_COMMAND, (ev) => {
    if (ev && ev.shiftKey) return false;
    ev && ev.preventDefault();
    sent.push(editor.getEditorState().read(() => $getRoot().getTextContent()));
    editor.update(() => { $getRoot().clear(); });
    return true;
  }, COMMAND_PRIORITY_HIGH);
}
window.lab = { sel: "#ed", text: () => editor.getEditorState().read(() => $getRoot().getTextContent()), sent: () => sent,
  clear: () => new Promise((r) => editor.update(() => { $getRoot().clear(); }, { onUpdate: r })) };
