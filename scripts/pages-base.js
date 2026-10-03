export function pagesBase(env = process.env) {
  // configure-pages supplies the actual path, including root/custom-domain sites.
  if (env.PAGES_BASE_PATH !== undefined) {
    const path = env.PAGES_BASE_PATH.replace(/^\/+|\/+$/g, '');
    return path ? `/${path}/` : '/';
  }
  const [owner, repository] = (env.GITHUB_REPOSITORY || '').split('/');
  if (!owner || !repository || repository.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/';
  return `/${repository}/`;
}
