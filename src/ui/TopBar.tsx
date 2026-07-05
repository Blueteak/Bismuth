import { RefreshCw, Settings2 } from 'lucide-react';
import { useAppStore } from '../state/appStore';

export function TopBar() {
  const regeneratePreview = useAppStore((state) => state.regeneratePreview);
  const quality = useAppStore((state) => state.settings.quality);
  const setSetting = useAppStore((state) => state.setSetting);

  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <h1>Bismuth</h1>
          <span>Realtime crystal viewport</span>
        </div>
      </div>

      <div className="top-actions">
        <label className="select-control">
          <Settings2 size={16} aria-hidden="true" />
          <span className="sr-only">Quality</span>
          <select
            value={quality}
            onChange={(event) => setSetting('quality', event.target.value as typeof quality)}
          >
            <option value="preview">Preview</option>
            <option value="standard">Standard</option>
            <option value="high">High</option>
          </select>
        </label>
        <button className="primary-action" type="button" onClick={regeneratePreview}>
          <RefreshCw size={17} aria-hidden="true" />
          <span>Regenerate</span>
        </button>
      </div>
    </header>
  );
}
