/// <reference types="vite/client" />

// ─────────────────────────────────────────────────────────────────────
// The File System Access API — newer than the DOM lib's declarations.
// Declared honestly here (the honest typing; never a window-as-any).
// ─────────────────────────────────────────────────────────────────────

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  multiple?: boolean;
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}
