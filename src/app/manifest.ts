import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?source=pwa",
    name: "winkox — Khelo aur Kamao",
    short_name: "winkox",
    description: "winkox — games, live casino aur earning ek hi app mein.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0b0716",
    theme_color: "#0b0716",
    orientation: "portrait",
    lang: "en",
    dir: "ltr",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
