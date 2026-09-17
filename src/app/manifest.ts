import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WinX555 — Khelo aur Kamao",
    short_name: "WinX555",
    description: "Pakistan ka premium gaming & earning platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0716",
    theme_color: "#0b0716",
    orientation: "portrait",
    icons: [
      { src: "/brand/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon.png", sizes: "64x64", type: "image/png" },
    ],
  };
}
