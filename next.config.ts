import type {NextConfig} from 'next';

function backendOriginForRewrite() {
  const raw =
    process.env.BACKEND_URL?.replace(/\/+$/, "") ??
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://127.0.0.1:5000";
  return raw.replace(/\/?api$/i, "").replace(/\/+$/, "") || "http://127.0.0.1:5000";
}

// Keep a running `next dev` server from sharing (and occasionally corrupting)
// the local production build output. Vercel expects Next's conventional `.next`
// directory while collecting deployment artifacts, so retain that default there.
const nextDistDir =
  process.env.VERCEL === "1"
    ? ".next"
    : process.env.NODE_ENV === "production"
      ? ".next-production"
      : ".next";

// Only development needs the longer client chunk timeout. Keeping the custom
// Webpack hook out of production lets Next use its build worker there.
const devWebpackConfig: Pick<NextConfig, "webpack"> =
  process.env.NODE_ENV === "development"
    ? {
        webpack: (config, { isServer }) => {
          if (!isServer) {
            config.output = { ...config.output, chunkLoadTimeout: 5 * 60 * 1000 };
          }
          return config;
        },
      }
    : {};

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
    // Keep recent routes ready without retaining almost the whole workspace in memory.
    maxInactiveAge: 2 * 60 * 1000,
    pagesBufferLength: 8,
  },
  typescript: {
    // Keep production builds blocked on type errors.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  ...devWebpackConfig,
  async rewrites() {
    const backendBaseUrl = backendOriginForRewrite();
    return {
      beforeFiles: [
        { source: "/api/realtime/:path*", destination: `${backendBaseUrl}/api/realtime/:path*` },
      ],
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
