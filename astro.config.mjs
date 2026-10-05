import { defineConfig } from 'astro/config';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1) ?? '';
const configuredBasePath = process.env.PUBLIC_BASE_PATH;
const isGitHubPagesBuild = process.env.DEPLOY_TARGET === 'github-pages';
const base = configuredBasePath ?? (isGitHubPagesBuild && repositoryName ? `/${repositoryName}` : '/');

export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL,
  base,
  build: {
    format: 'directory',
  },
  vite: {
    build: {
      sourcemap: false,
    },
  },
});
