const t = document.createElement("textarea"); t.id = "t"; t.rows = 5; t.cols = 60; document.getElementById("ed").appendChild(t);
const c = document.createElement("div"); c.id = "c"; c.contentEditable = "true"; c.className = "box"; document.getElementById("ed").appendChild(c);
const which = location.hash === "#ce" ? "c" : "t";
window.lab = { sel: "#" + which, text: () => (which === "t" ? t.value : c.innerText.replace(/\n$/, "")), clear: async () => { t.value = ""; c.textContent = ""; } };
