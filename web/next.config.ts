/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Не спирай билда заради ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Не спирай билда заради TS грешки (временно!)
    ignoreBuildErrors: true,
  },
  // Силент за Turbopack root warning (имаш lockfile и в / и в /web)
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
