import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Link } from '@tiptap/extension-link';
import { useEffect, useRef, useState } from 'react';
import { lmsAdminApi } from '../api/lmsAdmin';

interface LmsRichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function LmsRichTextEditor({ content, onChange, readOnly = false }: LmsRichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  
  // Suppress unused warning if compiler configuration is extremely strict
  if (uploadingImage) {
    console.log('Uploading asset...');
  }
  const [htmlValue, setHtmlValue] = useState(content || '');

  // Custom Image extension to add width support and selection support
  const CustomImage = Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        width: {
          default: '100%',
          renderHTML: attributes => {
            return {
              width: attributes.width,
              style: `width: ${attributes.width}; max-width: 100%; height: auto; cursor: pointer;`,
            };
          },
          parseHTML: element => element.getAttribute('width') || element.style.width || '100%',
        },
      };
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: false,
      }),
      CustomImage.configure({
        inline: true,
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    ],
    content: content || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      setHtmlValue(html);
    },
  });

  // Sync content prop when changed externally (e.g. on load or import)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
      setHtmlValue(content || '');
    }
  }, [content, editor]);

  // Handle Drag & Drop image files or Clipboard Paste image files directly on the editor
  useEffect(() => {
    if (!editor || readOnly) return;

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleUploadAndInsertImage(file);
          }
          break;
        }
      }
    };

    const dom = editor.view.dom;
    dom.addEventListener('paste', handlePaste);
    return () => {
      dom.removeEventListener('paste', handlePaste);
    };
  }, [editor, readOnly]);

  const handleUploadAndInsertImage = async (file: File) => {
    if (!editor) return;
    setUploadingImage(true);
    try {
      const res = await lmsAdminApi.uploadLmsAsset(file);
      const imageUrl = res.data.url;
      editor.chain().focus().setImage({ src: imageUrl }).run();
    } catch (err: any) {
      alert(`Error uploading image to Azure Storage: ${err?.response?.data?.message || err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUploadAndInsertImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addCalloutBox = (type: 'info' | 'success' | 'warning') => {
    if (!editor) return;
    const colors = {
      info: { bg: '#eff6ff', border: '#2563eb', title: 'Note:' },
      success: { bg: '#f0fdf4', border: '#16a34a', title: 'Important:' },
      warning: { bg: '#fffbe3', border: '#d97706', title: 'Warning:' },
    }[type];

    const calloutHtml = `<div style="padding: 12px 16px; background-color: ${colors.bg}; border-left: 4px solid ${colors.border}; border-radius: 4px; margin: 12px 0;"><strong>${colors.title}</strong> Add callout text here...</div><p></p>`;
    editor.chain().focus().insertContent(calloutHtml).run();
  };

  if (!editor) return null;

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', backgroundColor: '#ffffff' }}>
      {/* Hidden File Input for Image Uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Toolbar */}
      {!readOnly && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: editor.isActive('heading', { level: 2 }) ? '#e2e8f0' : '#ffffff', fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: editor.isActive('heading', { level: 3 }) ? '#e2e8f0' : '#ffffff', fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}
            title="Heading 3"
          >
            H3
          </button>

          <span style={{ color: '#cbd5e1', margin: '0 2px' }}>|</span>

          {/* Inline Formats */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: editor.isActive('bold') ? '#e2e8f0' : '#ffffff', fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: editor.isActive('italic') ? '#e2e8f0' : '#ffffff', fontStyle: 'italic', fontSize: 12, cursor: 'pointer' }}
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: editor.isActive('strike') ? '#e2e8f0' : '#ffffff', textDecoration: 'line-through', fontSize: 12, cursor: 'pointer' }}
            title="Strikethrough"
          >
            S
          </button>

          <span style={{ color: '#cbd5e1', margin: '0 2px' }}>|</span>

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: editor.isActive('bulletList') ? '#e2e8f0' : '#ffffff', fontSize: 12, cursor: 'pointer' }}
            title="Bullet List"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: editor.isActive('orderedList') ? '#e2e8f0' : '#ffffff', fontSize: 12, cursor: 'pointer' }}
            title="Ordered List"
          >
            1. List
          </button>

          <span style={{ color: '#cbd5e1', margin: '0 2px' }}>|</span>

          {/* Tables */}
          <button
            type="button"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: 12, cursor: 'pointer' }}
            title="Insert Table"
          >
            📊 Table
          </button>
          {editor.isActive('table') && (
            <>
              <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} style={{ padding: '4px 6px', fontSize: 11, cursor: 'pointer' }}>+Row</button>
              <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} style={{ padding: '4px 6px', fontSize: 11, cursor: 'pointer' }}>+Col</button>
              <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} style={{ padding: '4px 6px', fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>Del Table</button>
            </>
          )}

          <span style={{ color: '#cbd5e1', margin: '0 2px' }}>|</span>

          {/* Link */}
          <button
            type="button"
            onClick={setLink}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: editor.isActive('link') ? '#e2e8f0' : '#ffffff', fontSize: 12, cursor: 'pointer' }}
            title="Link"
          >
            🔗 Link
          </button>

          {/* Callout alert box */}
          <button
            type="button"
            onClick={() => addCalloutBox('info')}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            title="Insert Info Box"
          >
            💡 Info Box
          </button>

          <span style={{ color: '#cbd5e1', margin: '0 2px' }}>|</span>

          {/* Image Upload */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', color: '#166534', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            title="Upload image to Azure Storage"
          >
            {uploadingImage ? 'Uploading...' : '🖼️ Upload Image'}
          </button>

          <span style={{ color: '#cbd5e1', margin: '0 2px' }}>|</span>

          {/* HTML / WYSIWYG Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isHtmlMode) {
                // Save from HTML view back into editor
                editor.commands.setContent(htmlValue);
                onChange(htmlValue);
              } else {
                // Read current from editor to HTML textarea
                setHtmlValue(editor.getHTML());
              }
              setIsHtmlMode(!isHtmlMode);
            }}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #fca5a5', backgroundColor: isHtmlMode ? '#fee2e2' : '#ffffff', color: '#b91c1c', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}
            title="Toggle HTML Source"
          >
            {isHtmlMode ? '✍️ Visual' : '💻 HTML Source'}
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div style={{ padding: '12px 16px', minHeight: 250, maxHeight: 600, overflowY: 'auto', position: 'relative' }}>
        {/* Floating Bubble Menu for Selected Images / Tables */}
        {!readOnly && editor && (
          <>
            {/* Image Property Bubble Menu */}
            <BubbleMenu
              editor={editor}
              shouldShow={({ editor: currentEditor }: { editor: any }) => currentEditor.isActive('image')}
              updateDelay={100}
            >
              <div style={{ display: 'flex', gap: 4, padding: '4px 8px', backgroundColor: '#1e293b', borderRadius: 6, border: '1px solid #475569', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, marginRight: 4 }}>Width:</span>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().updateAttributes('image', { width: '25%' }).run()}
                  style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: editor.getAttributes('image').width === '25%' ? '#2563eb' : '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().updateAttributes('image', { width: '50%' }).run()}
                  style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: editor.getAttributes('image').width === '50%' ? '#2563eb' : '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().updateAttributes('image', { width: '75%' }).run()}
                  style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: editor.getAttributes('image').width === '75%' ? '#2563eb' : '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().updateAttributes('image', { width: '100%' }).run()}
                  style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: !editor.getAttributes('image').width || editor.getAttributes('image').width === '100%' ? '#2563eb' : '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                >
                  100%
                </button>
                <span style={{ color: '#475569', margin: '0 2px' }}>|</span>
                <button
                  type="button"
                  onClick={() => {
                    const alt = window.prompt('Enter Image Alt / Description Text:', editor.getAttributes('image').alt || '');
                    if (alt !== null) {
                      editor.chain().focus().updateAttributes('image', { alt }).run();
                    }
                  }}
                  style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer' }}
                  title="Alt Text"
                >
                  📝 Alt Text
                </button>
              </div>
            </BubbleMenu>

            {/* Table Property Bubble Menu */}
            <BubbleMenu
              editor={editor}
              shouldShow={({ editor: currentEditor }: { editor: any }) => currentEditor.isActive('table')}
              updateDelay={100}
            >
              <div style={{ display: 'flex', gap: 4, padding: '4px 8px', backgroundColor: '#1e293b', borderRadius: 6, border: '1px solid #475569', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, marginRight: 4 }}>Table:</span>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnBefore().run()}
                  style={{ padding: '3px 6px', borderRadius: 4, border: 'none', backgroundColor: '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer' }}
                >
                  +Col Left
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  style={{ padding: '3px 6px', borderRadius: 4, border: 'none', backgroundColor: '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer' }}
                >
                  +Col Right
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  style={{ padding: '3px 6px', borderRadius: 4, border: 'none', backgroundColor: '#991b1b', color: '#ffffff', fontSize: 11, cursor: 'pointer' }}
                >
                  -Col
                </button>
                <span style={{ color: '#475569', margin: '0 1px' }}>|</span>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowBefore().run()}
                  style={{ padding: '3px 6px', borderRadius: 4, border: 'none', backgroundColor: '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer' }}
                >
                  +Row Above
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  style={{ padding: '3px 6px', borderRadius: 4, border: 'none', backgroundColor: '#334155', color: '#ffffff', fontSize: 11, cursor: 'pointer' }}
                >
                  +Row Below
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  style={{ padding: '3px 6px', borderRadius: 4, border: 'none', backgroundColor: '#991b1b', color: '#ffffff', fontSize: 11, cursor: 'pointer' }}
                >
                  -Row
                </button>
                <span style={{ color: '#475569', margin: '0 1px' }}>|</span>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontSize: 11, cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🗑️ Delete Table
                </button>
              </div>
            </BubbleMenu>
          </>
        )}

        {isHtmlMode ? (
          <textarea
            value={htmlValue}
            onChange={(e) => {
              setHtmlValue(e.target.value);
              onChange(e.target.value);
            }}
            style={{
              width: '100%',
              minHeight: '230px',
              border: 'none',
              outline: 'none',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.5',
              resize: 'vertical',
            }}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      <style>{`
        .ProseMirror {
          outline: none;
          min-height: 220px;
          font-family: inherit;
          font-size: 15px;
          line-height: 1.6;
        }
        .ProseMirror p {
          margin-top: 0;
          margin-bottom: 0.8em;
        }
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1em 0;
          overflow: hidden;
        }
        .ProseMirror td, .ProseMirror th {
          min-width: 1em;
          border: 1px solid #cbd5e1;
          padding: 6px 10px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror th {
          font-weight: bold;
          text-align: left;
          background-color: #f1f5f9;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 8px 0;
          cursor: pointer;
          transition: outline 0.15s ease-in-out;
        }
        .ProseMirror img.ProseMirror-selectednode,
        .ProseMirror img:focus,
        .ProseMirror img:hover {
          outline: 3px solid #3b82f6;
          outline-offset: 2px;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #cbd5e1;
          padding-left: 12px;
          color: #64748b;
          margin: 12px 0;
        }
        /* Style for selected table cell helper */
        .ProseMirror .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
