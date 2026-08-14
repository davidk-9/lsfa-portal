# LMS Rich Content Authoring, TipTap WYSIWYG & Axcelerate Importer Plan

## Execution Backlog

### Item 1: Dedicated Content Block Editor Page & Live Student Preview
- **Dedicated Route (`frontend/src/pages/LmsBlockEditorPage.tsx`)**:
  - Replace the constrained modal editor with a full-page authoring view at `/admin/lms/blocks/new` and `/admin/lms/blocks/:id/edit`.
  - Provide full screen real estate for editing rich HTML text, tables, and media.
- **Side-by-Side Live Preview**:
  - Implement a split-screen layout: WYSIWYG Authoring Editor on the left, **Real-Time Student View Replica** on the right.
  - Preview renders identical typography, callout boxes, and video playback (`<LmsVideoPlayer />`) as seen in the student dashboard.
- **Form Navigation Guard**:
  - Add an unsaved changes alert if navigating away from an active editing session.

### Item 2: TipTap WYSIWYG Editor with Direct Azure Blob Image Upload
- **TipTap Integration (`frontend/src/components/LmsRichTextEditor.tsx`)**:
  - Integrate `@tiptap/react` with `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-table`, and `@tiptap/extension-link`.
  - Provide a clean formatting toolbar for headings, bold/italic, lists, tables, links, and alert callouts.
- **Direct Azure Storage Image Handler**:
  - Attach custom paste, drag-and-drop, and file picker listeners to the editor.
  - Automatically stream uploaded images to NestJS `AzureStorageService` (`POST /api/uploads/lms-asset`).
  - Store images in Azure Blob Storage under `lms-assets/` and insert permanent Azure URLs (`<img src="https://...blob.core.windows.net/lms-assets/..." />`).

### Item 3: "Import Axcelerate HTML" Auto-Sanitizer & Asset Migrator
- **UI Import Trigger**:
  - Add an **`[ 📥 Import Axcelerate HTML ]`** button next to `[ + Create Content Block ]` in `LmsAdminPage.tsx`.
- **Backend Import Endpoint (`POST /api/lms-admin/blobs/import-axcelerate`)**:
  - **HTML Parsing & Cleaning (`cheerio`)**: Parse pasted Axcelerate HTML, strip `contenteditable="false"` flags, remove `sc-*`/`arc-*` styled component classes, and remove SVG hero illustrations.
  - **Automated Image Migration**: Detect all `<img>` tags pointing to Axcelerate (`fs-prd.axcelerate.com.au`), fetch image buffers on the server, upload them directly to Azure Blob Storage via `AzureStorageService`, and update `src` attributes to permanent Azure Blob URLs.
  - **Vimeo Auto-Extraction**: Detect Vimeo `<iframe>` embed codes or player URLs and extract clean `vimeoId` strings.
  - **Editor Pre-fill**: Populate the extracted title, Vimeo ID, mapped KEs, and clean HTML directly into the TipTap block editor for final review and saving.