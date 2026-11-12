import ace from "ace-builds";
const ed = ace.edit("ed", { useWorker: false }); document.getElementById("ed").style.height = "160px";
window.lab = { sel: "#ed", focusSel: "#ed .ace_content", buffered: true, text: () => ed.getValue(), clear: async () => { ed.setValue("", -1); } };
