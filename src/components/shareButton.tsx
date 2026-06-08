'use client'
import React, { useState } from "react";
import { FaShareNodes } from "react-icons/fa6";

// Menu item that copies a permalink to the current results. All result state
// lives in the URL (useQsState), so window.location.href is the full link.
export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <li>
      <a
        onClick={handleShare}
        className="relative flex items-center gap-2"
        title="Copy a shareable link to these results"
      >
        Share Link to Results
        <FaShareNodes className="text-lg" />
        {copied && (
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-neutral text-neutral-content">
            Link copied
          </span>
        )}
      </a>
    </li>
  );
}
