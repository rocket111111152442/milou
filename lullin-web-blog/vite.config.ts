import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Ajoute « Blog » au tableau navigation de src/App.tsx au moment du build :
// l'en-tête, le menu mobile et le pied de page le reprennent tous les trois.
// À retirer le jour où le lien est écrit directement dans App.tsx.
const OFFRES = '{ label: "Offres", href: "/offres" },';
function blogNavigation(): Plugin {
  return {
    name: 'blog-navigation',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/App.tsx') || code.includes('href: "/blog"')) return null;
      if (!code.includes(OFFRES)) this.error('Lien « Offres » introuvable dans src/App.tsx : ajouter « Blog » à la navigation à la main.');
      return { code: code.replace(OFFRES, `${OFFRES}\n  { label: "Blog", href: "/blog" },`), map: null };
    },
  };
}

export default defineConfig({ plugins: [blogNavigation(), react()] });
