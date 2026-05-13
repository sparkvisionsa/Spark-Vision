import type {NextConfig} from 'next';
import { mvBackendOriginForProxy } from './src/lib/mv-backend-origin';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
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
    const backendBaseUrl =
      process.env.BACKEND_URL?.replace(/\/+$/, "") ??
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
      "http://127.0.0.1:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendBaseUrl}/uploads/:path*`,
      },
    ];
    const origin = mvBackendOriginForProxy();
    // fallback: only if no local app/api route matched (avoids proxying before Route Handlers).
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${origin}/api/:path*`,
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
    ],
  },
};

export default nextConfig;
