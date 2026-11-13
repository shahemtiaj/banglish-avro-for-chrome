import tinymce from "tinymce"; import "tinymce/themes/silver"; import "tinymce/icons/default"; import "tinymce/models/dom";
const [ed] = await tinymce.init({ selector: "#ed", skin: false, content_css: false, menubar: false, toolbar: false, statusbar: false, license_key: "gpl", inline: location.hash === "#inline" });
window.lab = { sel: location.hash === "#inline" ? "#ed" : "iframe", frame: location.hash !== "#inline", text: () => ed.getContent({ format: "text" }), clear: async () => { ed.setContent(""); } };
