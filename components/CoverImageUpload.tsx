"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, DragEvent, KeyboardEvent } from "react";

type Props = {
  inputId: string;
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
};

const ACCEPTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function CoverImageUpload({
  inputId,
  value,
  onChange,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(
    () => (value ? URL.createObjectURL(value) : null),
    [value],
  );

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openPicker() {
    if (disabled) {
      return;
    }

    inputRef.current?.click();
  }

  function clearSelection() {
    if (disabled) {
      return;
    }

    onChange(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFile(file: File | null) {
    if (!file) {
      clearSelection();
      return;
    }

    if (!isAcceptedImage(file)) {
      setError("Cover image must be PNG, JPG, JPEG, or WebP.");
      return;
    }

    setError(null);
    onChange(file);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    handleFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        onChange={handleInputChange}
        disabled={disabled}
        style={hiddenInputStyle}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={`${inputId}-help`}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        style={{
          ...dropzoneStyle,
          ...(disabled ? dropzoneDisabledStyle : {}),
        }}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="" aria-hidden="true" style={previewImageStyle} />
            <div style={dropzoneCopyStyle}>
              <p style={dropzoneLabelStyle}>Cover image selected</p>
              <p style={dropzoneTextStyle}>{value?.name}</p>
              <p style={dropzoneHintStyle}>
                Click, drop a new image, or replace/remove the current selection.
              </p>
            </div>
          </>
        ) : (
          <div style={dropzoneCopyStyle}>
            <p style={dropzoneLabelStyle}>Upload cover image</p>
            <p style={dropzoneTextStyle}>
              Click to upload or drag and drop a PNG, JPG, JPEG, or WebP file.
            </p>
            <p style={dropzoneHintStyle}>Recommended for featured cards and resource pages.</p>
          </div>
        )}
      </div>

      <div style={actionRowStyle}>
        <button type="button" onClick={openPicker} disabled={disabled} style={secondaryButtonStyle}>
          {previewUrl ? "Replace image" : "Choose image"}
        </button>
        <button
          type="button"
          onClick={clearSelection}
          disabled={disabled || !value}
          style={secondaryButtonStyle}
        >
          Remove image
        </button>
      </div>

      <p id={`${inputId}-help`} style={helperTextStyle}>
        Accepted formats: PNG, JPG, JPEG, and WebP.
      </p>

      {error ? <p style={errorStyle}>{error}</p> : null}
    </div>
  );
}

function isAcceptedImage(file: File) {
  if (ACCEPTED_MIME_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp";
}

const hiddenInputStyle = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} satisfies CSSProperties;

const dropzoneStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 260px) minmax(0, 1fr)",
  gap: 16,
  alignItems: "stretch",
  padding: 16,
  borderRadius: 8,
  border: "1px dashed var(--border)",
  background: "#0a0a0a",
  cursor: "pointer",
} satisfies CSSProperties;

const dropzoneDisabledStyle = {
  opacity: 0.65,
  cursor: "not-allowed",
} satisfies CSSProperties;

const previewImageStyle = {
  width: "100%",
  minHeight: 160,
  maxHeight: 200,
  objectFit: "cover",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
} satisfies CSSProperties;

const dropzoneCopyStyle = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  minWidth: 0,
} satisfies CSSProperties;

const dropzoneLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} satisfies CSSProperties;

const dropzoneTextStyle = {
  color: "var(--text-primary)",
  fontSize: 14,
  lineHeight: 1.6,
  marginBottom: 8,
} satisfies CSSProperties;

const dropzoneHintStyle = {
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.6,
} satisfies CSSProperties;

const actionRowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
} satisfies CSSProperties;

const secondaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "10px 14px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
  minWidth: 128,
  cursor: "pointer",
} satisfies CSSProperties;

const helperTextStyle = {
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.6,
} satisfies CSSProperties;

const errorStyle = {
  color: "var(--error)",
  fontSize: 12,
  lineHeight: 1.6,
} satisfies CSSProperties;
