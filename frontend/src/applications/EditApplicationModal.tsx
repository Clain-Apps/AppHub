import { type ChangeEvent, type FormEvent, type MouseEvent, useEffect, useId, useRef, useState } from "react";
import type { HostedApplication } from "apphub-shared";
import { useApplicationState } from "../state/applicationState";
import "./EditApplicationModal.scss";

type ChosenImage = {
  file: File;
  previewAddress: string;
};

export function EditApplicationModal({
  application,
  onClose,
}: {
  application: HostedApplication;
  onClose(): void;
}) {
  const { updateApplicationDisplay, uploadApplicationImage } = useApplicationState();
  const titleFieldIdentifier = useId();
  const imageFieldIdentifier = useId();
  const dialogReference = useRef<HTMLDivElement>(null);
  const [displayName, setDisplayName] = useState(application.displayName);
  const [chosenImage, setChosenImage] = useState<ChosenImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dialogReference.current?.querySelector<HTMLInputElement>("input[name='displayName']")?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (chosenImage) URL.revokeObjectURL(chosenImage.previewAddress);
    };
  }, [chosenImage]);

  const previewAddress = chosenImage?.previewAddress ?? application.imageAddress;

  return (
    <div className="edit-application-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        ref={dialogReference}
        className="edit-application-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${titleFieldIdentifier}-heading`}
      >
        <h2 id={`${titleFieldIdentifier}-heading`} className="view-title">
          Edit application
        </h2>
        <p className="edit-application-folder">{application.folderName}</p>
        <form className="edit-application-form" onSubmit={handleSave}>
          {previewAddress ? (
            <img className="edit-application-preview" src={previewAddress} alt="" />
          ) : (
            <div className="edit-application-preview is-empty" aria-hidden="true" />
          )}
          <label htmlFor={titleFieldIdentifier}>
            Title
            <input
              id={titleFieldIdentifier}
              name="displayName"
              value={displayName}
              maxLength={80}
              required
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label htmlFor={imageFieldIdentifier}>
            Image
            <input
              id={imageFieldIdentifier}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleImageChosen}
            />
          </label>
          <div className="edit-application-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !displayName.trim()}>
              {isSaving ? "Saving" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) onClose();
  }

  function handleImageChosen(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null;
    setChosenImage(file ? { file, previewAddress: URL.createObjectURL(file) } : null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) return;
    setIsSaving(true);
    try {
      await updateApplicationDisplay({ folderName: application.folderName, displayName: trimmedDisplayName });
      if (chosenImage) {
        await uploadApplicationImage({ folderName: application.folderName, imageFile: chosenImage.file });
      }
      onClose();
    } catch {
      // The notice is set by the application state actions.
    } finally {
      setIsSaving(false);
    }
  }
}
