const h = location.hash;
const root = document.getElementById("ed");
if (h === "#design") { const f = document.createElement("iframe"); f.id = "f"; f.style.cssText = "width:500px;height:150px"; root.appendChild(f); f.contentDocument.open(); f.contentDocument.write("<!doctype html><body></body>"); f.contentDocument.close(); f.contentDocument.designMode = "on";
  window.lab = { sel: "#f", frame: true, text: () => f.contentDocument.body.innerText.replace(/\n$/, ""), clear: async () => { f.contentDocument.body.innerHTML = ""; } };
} else if (h === "#srcdoc") { const f = document.createElement("iframe"); f.id = "f"; f.srcdoc = "<textarea id=t rows=4 cols=50></textarea>"; root.appendChild(f);
  window.lab = { sel: "#f", frame: true, frameSel: "#t", text: () => f.contentDocument.getElementById("t").value, clear: async () => { f.contentDocument.getElementById("t").value = ""; } };
} else if (h === "#ce-html") { root.innerHTML = '<div id="c" contenteditable="true" class="box"><p>Hello <b>bold</b> world</p><p><br></p></div>';
  window.lab = { sel: "#c", text: () => document.getElementById("c").innerText.replace(/\n$/, ""), clear: async () => { document.getElementById("c").innerHTML = "<p><br></p>"; } };
} else if (h === "#ce-plaintext") { root.innerHTML = '<div id="c" contenteditable="plaintext-only" class="box"></div>';
  window.lab = { sel: "#c", text: () => document.getElementById("c").innerText.replace(/\n$/, ""), clear: async () => { document.getElementById("c").textContent = ""; } };
} else if (h === "#search") { root.innerHTML = '<form onsubmit="window.__submitted=(window.__submitted||[]).concat(this.q.value);return false"><input type="search" id="q" name="q" style="width:400px"><button type="submit">Go</button></form>';
  window.lab = { sel: "#q", text: () => document.getElementById("q").value, sent: () => window.__submitted || [], clear: async () => { document.getElementById("q").value = ""; } };
} else if (h === "#dialog") { root.innerHTML = '<dialog id="d"><p>Modal</p><textarea id="t" rows="5" cols="50"></textarea></dialog>'; const d = document.getElementById("d"); d.showModal(); d.addEventListener("close", () => d.showModal());
  window.lab = { sel: "#t", text: () => document.getElementById("t").value, clear: async () => { document.getElementById("t").value = ""; } };
} else if (h === "#transform") { document.documentElement.style.transform = "translateZ(0)"; document.body.style.cssText += ";height:2000px;overflow:hidden"; root.innerHTML = '<div style="height:300px"></div><div id="c" contenteditable="true" class="box"></div>';
  window.lab = { sel: "#c", text: () => document.getElementById("c").innerText.replace(/\n$/, ""), clear: async () => { document.getElementById("c").textContent = ""; } };
} else { root.innerHTML = '<textarea id="t" rows="5" cols="60"></textarea>';
  window.lab = { sel: "#t", text: () => document.getElementById("t").value, clear: async () => { document.getElementById("t").value = ""; } }; }
