/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Photos are served by the booking API on Railway.
    remotePatterns: [
      { protocol: 'https', hostname: '**.up.railway.app' },
      { protocol: 'https', hostname: '**.railway.app' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
