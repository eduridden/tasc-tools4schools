
"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { safeImageUrl } from "@/lib/url";

interface ToolLogoProps {
  toolUrl: string;
  toolName: string;
  logoUrl?: string;
  size?: number;
}

const generateHslColorFromString = (str: string) => {
  let hash = 0;
  if (!str || str.length === 0) {
    return `hsl(0, 90%, 70%)`;
  }
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  // Use higher saturation and lower lightness for brighter, more accessible colors
  const saturation = 70 + (hash % 10); // 70-80%
  const lightness = 65 + (hash % 10); // 65-75%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const FallbackLogo = ({ toolName, size }: { toolName: string, size: number }) => {
  const firstLetter = toolName ? toolName.charAt(0).toUpperCase() : '?';
  const bgColor = generateHslColorFromString(toolName);
  const style = {
    width: `${size}px`,
    height: `${size}px`,
    backgroundColor: bgColor,
    fontSize: `${size * 0.6}px`
  };

  return (
    <div
      className="rounded-lg flex items-center justify-center font-bold text-white"
      style={style}
    >
      {firstLetter}
    </div>
  );
};


export function ToolLogo({ toolUrl, toolName, logoUrl, size = 25 }: ToolLogoProps) {
  const [error, setError] = useState(false);
  // Logo URLs are stored in Firestore by admins and surfaced via the AI
  // `findLogo` callable. Pass through the allowlist so tool entries cannot
  // request arbitrary attacker-controlled hosts as user IP-leakage pixels.
  const safeLogo = safeImageUrl(logoUrl);

  useEffect(() => {
    setError(false); // Reset error state when props change
  }, [logoUrl]);

  // If there's no logoUrl, the URL was not on the allowlist, or it failed
  // to load, show the fallback.
  if (!safeLogo || error) {
    return <FallbackLogo toolName={toolName} size={size} />;
  }

  return (
    <div style={{ width: `${size}px`, height: `${size}px` }} className="flex items-center justify-center">
      <img
        key={safeLogo}
        src={safeLogo}
        alt={`${toolName} logo`}
        className="rounded-lg object-contain"
        style={{ width: `${size}px`, height: `${size}px` }}
        onError={() => {
          setError(true);
        }}
      />
    </div>
  );
}
