class XBox extends HTMLElement { connectedCallback() { const r = this.attachShadow({ mode: location.hash.includes("closed") ? "closed" : "open" }); this._r = r;
  r.innerHTML = location.hash.includes("ce") ? '<div id="e" contenteditable="true" style="border:1px solid #888;min-height:60px;padding:8px"></div>' : '<textarea id="e" rows="4" cols="50"></textarea>'; } }
customElements.define("x-box", XBox);
const host = document.createElement("x-box"); host.id = "host"; document.getElementById("ed").appendChild(host);
const inner = () => host._r.getElementById("e");
window.lab = { sel: "#host", text: () => ("value" in inner() ? inner().value : inner().innerText.replace(/\n$/, "")), clear: async () => { if ("value" in inner()) inner().value = ""; else inner().textContent = ""; } };
