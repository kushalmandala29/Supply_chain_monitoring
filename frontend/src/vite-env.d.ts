/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_WS_URL: string;
  readonly VITE_GATEWAY_HTTP_URL?: string;
  readonly VITE_GLOBE_IMAGE_URL?: string;
  readonly VITE_GLOBE_BUMP_URL?: string;
  readonly VITE_GLOBE_BACKGROUND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
