// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     unoptimized: true, // good for static sites
//   },
//   output: 'export', // optional: for static HTML export
// }

// export default nextConfig




/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
