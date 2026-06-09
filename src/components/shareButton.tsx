'use client'
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaShareNodes } from "react-icons/fa6";

// Menu item that opens a modal with the current results' permalink, pre-selected for copy.
export default function ShareButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const openShare = () => {
    setUrl(window.location.href);
    dialogRef.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.select());
  };

  return (
    <li>
      <a
        onClick={openShare}
        className="flex items-center gap-2"
        title="Share link to these results"
      >
        Share Link to Results
        <FaShareNodes className="text-lg" />
      </a>
      {/* Portaled to <body> so daisyUI's `.menu li > *` rule can't style the closed dialog. */}
      {mounted &&
        createPortal(
          <dialog className="modal" ref={dialogRef}>
            <div className="modal-box max-w-xl">
              <p className="mb-3 text-center text-gray-900 dark:text-white">
                Use Ctrl+C or Option+C to copy the link below.
              </p>
              <input
                ref={inputRef}
                type="text"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="input input-bordered w-full"
              />
            </div>
            <form method="dialog" className="modal-backdrop">
              <button aria-label="Close">close</button>
            </form>
          </dialog>,
          document.body
        )}
    </li>
  );
}
