import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "firebase/app": "./app/lib/firebase-mock.js",
      "firebase/auth": "./app/lib/firebase-mock.js",
      "firebase/firestore": "./app/lib/firebase-mock.js",
      "firebase/storage": "./app/lib/firebase-mock.js"
    }
  },
  webpack: (config) => {
    config.resolve.alias["firebase/app"] = path.resolve(__dirname, "app/lib/firebase-mock.js");
    config.resolve.alias["firebase/auth"] = path.resolve(__dirname, "app/lib/firebase-mock.js");
    config.resolve.alias["firebase/firestore"] = path.resolve(__dirname, "app/lib/firebase-mock.js");
    config.resolve.alias["firebase/storage"] = path.resolve(__dirname, "app/lib/firebase-mock.js");
    return config;
  },
  serverExternalPackages: ["jspdf", "jspdf-autotable", "fflate"],
};

export default nextConfig;
