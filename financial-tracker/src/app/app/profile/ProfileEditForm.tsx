"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, type ProfileState } from "@/server/actions/profile";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

export function ProfileEditForm({
  initialName,
  initialImage,
}: {
  initialName: string;
  initialImage: string | null;
}) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(initialImage ?? "");
  const [imageError, setImageError] = useState(false);
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    {},
  );
  return (
    <form action={formAction} className="mb-card p-6 flex flex-col gap-5">
      <Eyebrow>Display name</Eyebrow>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          Name
        </span>
        <input
          name="name"
          maxLength={60}
          defaultValue={initialName}
          placeholder="e.g. Arief"
          className="mb-input"
        />
      </label>
      <div className="border-t border-line pt-5">
        <Eyebrow>Profile picture</Eyebrow>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          Image URL
        </span>
        <input
          type="text"
          name="image"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value);
            setImageError(false);
          }}
          placeholder="https://example.com/avatar.jpg"
          className="mb-input"
          maxLength={2048}
        />
      </label>
      {imageUrl && !imageError && (
        <div className="flex justify-center">
          <img
            src={imageUrl}
            alt="Profile preview"
            className="w-20 h-20 object-cover rounded-full"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      {imageUrl && imageError && (
        <p className="font-mono text-xs text-[var(--color-down)]">
          Failed to load image
        </p>
      )}
      {!imageUrl && initialImage && (
        <div className="flex justify-center">
          <img
            src={initialImage}
            alt="Current profile picture"
            className="w-20 h-20 object-cover rounded-full"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      {state?.error && (
        <p className="font-mono text-xs text-[var(--color-down)]">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="font-mono text-xs text-[var(--color-up)]">Saved.</p>
      )}
      <div className="flex gap-3">
        <GoldButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </GoldButton>
        <button
          type="button"
          onClick={() => router.back()}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors px-4 py-2.5 border border-line hover:border-gold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
