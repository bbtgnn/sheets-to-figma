/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPREADSHEET_FETCH_API: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
