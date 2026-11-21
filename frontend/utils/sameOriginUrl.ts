export const sameOriginTreeUrl = (publicPath: string, origin: string = window.location.origin): string => {
  if (!/^\/t\/[A-Za-z0-9_-]+$/.test(publicPath)) throw new Error('Invalid public tree path.');
  const normalizedOrigin = origin.replace(/\/$/, '');
  return `${normalizedOrigin}${publicPath}`;
};
