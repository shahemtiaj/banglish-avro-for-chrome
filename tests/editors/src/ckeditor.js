import { ClassicEditor, Essentials, Paragraph } from "ckeditor5";
const editor = await ClassicEditor.create(document.getElementById("ed"), { licenseKey: "GPL", plugins: [Essentials, Paragraph], toolbar: [] });
window.lab = { sel: ".ck-editor__editable", text: () => editor.getData().replace(/<\/p><p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " "), clear: async () => { editor.setData(""); } };
