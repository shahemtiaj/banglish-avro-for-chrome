import React from "react"; import { createRoot } from "react-dom/client";
import { Editor, EditorState, ContentState } from "draft-js";
let cur; let setter;
function App() { const [s, set] = React.useState(() => EditorState.createEmpty()); cur = s; setter = set;
  return <div className="box" id="ed"><Editor editorState={s} onChange={set} /></div>; }
createRoot(document.getElementById("root")).render(<App />);
window.lab = { sel: "#ed .public-DraftEditor-content", text: () => cur.getCurrentContent().getPlainText("\n"),
  clear: async () => { setter(EditorState.moveFocusToEnd(EditorState.push(cur, ContentState.createFromText(""), "remove-range"))); await new Promise(r => setTimeout(r, 50)); } };
