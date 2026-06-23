/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    VITE_CLIENT_KEY: process.env.VITE_CLIENT_KEY,
    VITE_CLIENT_URL: process.env.VITE_CLIENT_URL,
  },
};

export default nextConfig;
