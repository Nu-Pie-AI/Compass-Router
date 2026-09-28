"use client";

import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  error?: string;
}

export function ImageUpload({ value, onChange, label = "Logo", error }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [preview, setPreview] = useState(value || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 5MB.");
      return;
    }

    setUploadError("");
    setUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload image");
      setPreview("");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview("");
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUrlChange = (url: string) => {
    setPreview(url);
    onChange(url);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--muted-foreground)]">{label}</label>

      {/* Preview */}
      {preview && (
        <div className="relative inline-block">
          <div className="w-32 h-32 border-2 border-[var(--border)] rounded-lg overflow-hidden bg-[var(--background)] flex items-center justify-center">
            <img
              src={preview}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Button */}
      {!preview && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-[var(--muted-foreground)]">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-sm text-[var(--muted-foreground)]">Upload Image</span>
              </>
            )}
          </button>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Max 5MB • JPEG, PNG, WebP
          </p>
        </div>
      )}

      {/* OR Divider */}
      {!preview && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--background)]"></div>
          <span className="text-xs text-[var(--muted-foreground)]">OR</span>
          <div className="flex-1 h-px bg-[var(--background)]"></div>
        </div>
      )}

      {/* URL Input */}
      {!preview && (
        <div>
          <input
            type="url"
            value={value || ""}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Or enter an image URL
          </p>
        </div>
      )}

      {/* Error Messages */}
      {(uploadError || error) && (
        <p className="text-red-500 text-sm">{uploadError || error}</p>
      )}
    </div>
  );
}
