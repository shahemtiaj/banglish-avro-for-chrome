import React from "react"; import { createRoot } from "react-dom/client";
let state = { a: "", b: "" };
function App() { const [a, setA] = React.useState(""); const [b, setB] = React.useState(""); state = { a, b };
  return <div><input id="inp" value={a} onChange={(e) => setA(e.target.value)} style={{ width: 400 }} /><br /><br />
    <textarea id="ta" value={b} onChange={(e) => setB(e.target.value)} rows={4} cols={50} /></div>; }
createRoot(document.getElementById("root")).render(<App />);
const which = location.hash === "#ta" ? "b" : "a";
window.lab = { sel: which === "a" ? "#inp" : "#ta", text: () => state[which], clear: async () => {
  const el = document.querySelector(which === "a" ? "#inp" : "#ta"); const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set; set.call(el, ""); el.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 30)); } };
