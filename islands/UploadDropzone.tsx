import { JSX } from "preact";
import { useRef, useState } from "preact/hooks";

interface UploadDropzoneProps {
  action?: string;
}

export default function UploadDropzone(
  { action = "/upload" }: UploadDropzoneProps,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("or use Select Files below");
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Waiting to upload...");

  const setUploadProgress = (value: number, text: string) => {
    const percentage = Math.max(
      0,
      Math.min(100, Math.floor(Number(value) || 0)),
    );
    setShowProgress(true);
    setProgress(percentage);
    setProgressText(text);
  };

  const handleInputChange = () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setFileName("or use Select Files below");
      setShowProgress(false);
      return;
    }
    setFileName(file.name);
    setUploadProgress(0, "Ready to upload.");
  };

  const handleDrop: JSX.DragEventHandler<HTMLLabelElement> = (event) => {
    event.preventDefault();
    setDragActive(false);

    const droppedFiles = event.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0 || !inputRef.current) return;

    const transfer = new DataTransfer();
    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles.item(i);
      if (file) transfer.items.add(file);
    }
    inputRef.current.files = transfer.files;
    handleInputChange();
  };

  const handleSubmit: JSX.GenericEventHandler<HTMLFormElement> = (event) => {
    const form = formRef.current;
    const file = inputRef.current?.files?.[0];
    if (!form || !file) return;

    event.preventDefault();
    setSubmitting(true);
    setUploadProgress(0, "Uploading...");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", action);
    xhr.upload.onprogress = (progressEvent) => {
      if (!progressEvent.lengthComputable) return;
      setUploadProgress(
        (progressEvent.loaded / progressEvent.total) * 100,
        "Uploading...",
      );
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 400) {
        setUploadProgress(100, "Upload complete.");
        globalThis.location.reload();
        return;
      }
      setUploadProgress(0, "Upload failed. Please try again.");
      setSubmitting(false);
    };
    xhr.onerror = () => {
      setUploadProgress(0, "Upload failed. Please try again.");
      setSubmitting(false);
    };
    xhr.send(new FormData(form));
  };

  return (
    <form
      ref={formRef}
      method="post"
      action={action}
      encType="multipart/form-data"
      class="upload-wizard-form"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="action" value="upload" />
      <input
        id="import-file-input"
        ref={inputRef}
        class="upload-file-input"
        type="file"
        name="export_file"
        accept=".zip,application/zip"
        required
        onChange={handleInputChange}
      />
      <label
        class={`upload-drop-area ${dragActive ? "drag-active" : ""}`}
        for="import-file-input"
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <strong>Drop your Strava export zip here</strong>
        <span>{fileName}</span>
      </label>
      <label class="upload-select-button primary" for="import-file-input">
        Select Files
      </label>

      {showProgress && (
        <div style="width: 100%;">
          <div
            class="task-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div class="task-progress-fill" style={`width: ${progress}%;`} />
            <span class="task-progress-label">{progress}%</span>
          </div>
          <p>{progressText}</p>
        </div>
      )}

      <button type="submit" disabled={submitting}>Upload</button>
    </form>
  );
}
