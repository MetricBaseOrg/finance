import type { MetadataRoute } from "next";

// Lets "Add to Home Screen" install Bingkai with its own icon and dark theme, which
// matters for an app people open from a campaign link on their phone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bingkai — twibbon tanpa unggah",
    short_name: "Bingkai",
    description:
      "Bingkai kampanye tanpa akun, tanpa watermark. Fotomu diproses di perangkatmu sendiri.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/bingkai-mark.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
