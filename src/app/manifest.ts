import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life Flow",
    short_name: "Life Flow",
    description: "일정, 할 일, 운동, 돈 관리를 한곳에서 관리합니다.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#202124",
    lang: "ko-KR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
