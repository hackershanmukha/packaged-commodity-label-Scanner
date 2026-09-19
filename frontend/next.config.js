/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://127.0.0.1:8000/uploads/:path*',
      },
      {
        source: '/reports/:path*',
        destination: 'http://127.0.0.1:8000/reports/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
