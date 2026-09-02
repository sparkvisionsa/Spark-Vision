import type {NextConfig} from 'next';

function backendOriginForRewrite() {
  const raw =
    process.env.BACKEND_URL?.replace(/\/+$/, "") ??
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://127.0.0.1:5000";
  return raw.replace(/\/?api$/i, "").replace(/\/+$/, "") || "http://127.0.0.1:5000";
}

// Keep a running `next dev` server from sharing (and occasionally corrupting)
// the production build output. `next start` runs with NODE_ENV=production as
// well, so it resolves the same directory produced by `next build`.
const nextDistDir = process.env.NODE_ENV === "production" ? ".next-production" : ".next";

const nextConfig: NextConfig = {
  distDir: nextDistDir,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Genkit and its Express-based reflection runtime are Node-only packages.
  // Keep them external instead of asking Webpack to analyze Express dynamic requires.
  serverExternalPackages: ["genkit", "@genkit-ai/core", "@genkit-ai/google-genai"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    /** Must match large MV uploads; default ~10MB truncates multipart when middleware exists. */
    middlewareClientMaxBodySize: '160mb',
    serverActions: {
      bodySizeLimit: '160mb',
    },
  },
  onDemandEntries: {
    // Keep recently visited routes in memory during dev for faster back/forward navigation
    // Lower values reduce memory/CPU pressure in very large apps during dev.
    maxInactiveAge: 15 * 60 * 1000,
    pagesBufferLength: 40,
  },
  typescript: {
    // Keep production builds blocked on type errors.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const backendBaseUrl = backendOriginForRewrite();
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backendBaseUrl}/api/:path*`,
        },
        {
          source: "/uploads/:path*",
          destination: `${backendBaseUrl}/uploads/:path*`,
        },
      ],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.digitaloceanspaces.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
