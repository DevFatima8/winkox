import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WinX555 — Khelo aur Kamao",
    short_name: "WinX555",
    description: "Pakistan ka premium gaming & earning platform.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0716",
    theme_color: "#0b0716",
    orientation: "portrait",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
