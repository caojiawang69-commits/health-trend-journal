import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'showcase',base:'./',plugins:[react()],build:{license:true,outDir:'../docs',emptyOutDir:true}});
