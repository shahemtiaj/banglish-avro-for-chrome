import React from "react"; import { createRoot } from "react-dom/client";
import { createEditor, Node, Transforms, Editor } from "slate"; import { Slate, Editable, withReact } from "slate-react"; import { withHistory } from "slate-history";
let ed;
function App() { const [editor] = React.useState(() => withHistory(withReact(createEditor()))); ed = editor;
  return <Slate editor={editor} initialValue={[{ type: "paragraph", children: [{ text: "" }] }]}><Editable id="ed" className="box" /></Slate>; }
createRoot(document.getElementById("root")).render(<App />);
window.lab = { sel: "#ed", text: () => ed.children.map((n) => Node.string(n)).join("\n"),
  clear: async () => { Transforms.delete(ed, { at: { anchor: Editor.start(ed, []), focus: Editor.end(ed, []) } }); await new Promise(r => setTimeout(r, 50)); } };
