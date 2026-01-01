// Simple wrapper to attribute TMDB-hosted images.
import React from "react";

export default function TmdbImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  ...rest
}) {
  const isTmdb = typeof src === "string" && src.includes("image.tmdb.org");

  if (!isTmdb) {
    return <img src={src} alt={alt} className={className} {...rest} />;
  }

  return (
    <span
      className={`tmdb-credit relative inline-block overflow-hidden ${
        className || ""
      }`.trim()}
    >
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${imgClassName || ""}`.trim()}
        {...rest}
      />
    </span>
  );
}
