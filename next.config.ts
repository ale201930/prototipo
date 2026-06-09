import type { NextConfig } from "next";
import path from "path";

const useFirebase = process.env.NEXT_PUBLIC_USE_FIREBASE === "true";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: useFirebase ? {} : {
      "firebase/app": "./app/lib/firebase-mock.js",
      "firebase/auth": "./app/lib/firebase-mock.js",
      "firebase/firestore": "./app/lib/firebase-mock.js",
      "firebase/storage": "./app/lib/firebase-mock.js"
    }
  },
  webpack: (config) => {
    if (!useFirebase) {
      config.resolve.alias["firebase/app"] = path.resolve(__dirname, "app/lib/firebase-mock.js");
      config.resolve.alias["firebase/auth"] = path.resolve(__dirname, "app/lib/firebase-mock.js");
      config.resolve.alias["firebase/firestore"] = path.resolve(__dirname, "app/lib/firebase-mock.js");
      config.resolve.alias["firebase/storage"] = path.resolve(__dirname, "app/lib/firebase-mock.js");
    }
    return config;
  },
  serverExternalPackages: ["jspdf", "jspdf-autotable", "fflate"],
};

export default nextConfig;
