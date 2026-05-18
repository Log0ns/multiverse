import pathlib

f = pathlib.Path(r"c:\Users\Logan.Jacobson\Desktop\Learning\Multiverse\app.js")
src = f.read_text(encoding="utf-8")

old = """    html += '<div class="btn-row">';
    html += '<button class="btn edit-save-btn">Save</button>';
    html += '<button class="btn btn-secondary edit-cancel-btn">Cancel</button>';
    html += '<button class="btn btn-danger edit-delete-btn" style="margin-left:auto;">Delete</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="resize-handle"></div>';"""

new = """    html += '</div>';
    html += '<div class="btn-row" style="padding:10px 16px;border-top:1px solid #374151;">';
    html += '<button class="btn edit-save-btn">Save</button>';
    html += '<button class="btn btn-secondary edit-cancel-btn">Cancel</button>';
    html += '<button class="btn btn-danger edit-delete-btn" style="margin-left:auto;">Delete</button>';
    html += '</div>';
    html += '<div class="resize-handle"></div>';"""

if old not in src:
    print("ERROR: old string not found")
else:
    src = src.replace(old, new)
    f.write_text(src, encoding="utf-8", newline="\n")
    print("Patched successfully")
