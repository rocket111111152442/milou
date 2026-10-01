/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Add the host of Taco J's photo CDN here if photos are not stored in /public.
    remotePatterns: [],
  },
};
export default nextConfig;
