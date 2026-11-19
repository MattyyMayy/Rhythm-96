import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces one self-contained dist/index.html (JS and CSS inlined),
// which you can open directly, host anywhere, or publish as a Claude artifact.
export default defineConfig({
  plugins: [viteSingleFile()],
});
