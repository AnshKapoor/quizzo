import { useRef, useState } from 'react';
import { imageFromTransfer, imageKb, imageToDataUrl } from '../lib/image';
import { useImageSrc } from './ImageContext';

interface Props {
  label: string;
  value: string;
  onChange: (src: string) => void;
  help?: string;
}

/** A picture on a card: paste (Ctrl+V), drop, or choose a file. Shows a preview with Remove. */
export function ImageField({ label, value, onChange, help }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const src = useImageSrc(value);

  const take = async (f: Blob | null | undefined) => {
    if (!f) return;
    setError(null);
    try {
      onChange(await imageToDataUrl(f));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="field image-field">
      <span>{label}</span>
      {value ? (
        <div className="image-preview">
          {src ? <img src={src} alt="" /> : <small className="error">⚠ Picture missing</small>}
          <div className="row">
            <small className="sub">{src?.startsWith('data:') ? `${imageKb(src)} KB` : src ? 'Linked picture' : ''}</small>
            <button type="button" className="ghost" onClick={() => file.current?.click()}>
              Replace
            </button>
            <button type="button" className="ghost danger" onClick={() => onChange('')}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`image-drop ${over ? 'over' : ''}`}
          tabIndex={0}
          role="button"
          aria-label={`${label}: paste, drop or choose a picture`}
          onClick={() => file.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              file.current?.click();
            }
          }}
          onPaste={(e) => {
            const f = imageFromTransfer(e.clipboardData);
            if (f) {
              e.preventDefault();
              e.stopPropagation();
              take(f);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(imageFromTransfer(e.dataTransfer));
          }}
        >
          🖼 Paste a picture (Ctrl+V), drop one here, or <u>choose a file</u>
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {help && <small>{help}</small>}
      {error && <small className="error">⚠ {error}</small>}
    </div>
  );
}
