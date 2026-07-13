/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_WS_URL: string;
  readonly VITE_GATEWAY_HTTP_URL?: string;
  readonly VITE_MAP_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
