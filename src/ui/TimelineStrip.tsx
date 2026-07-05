import { Camera, Circle, Rotate3D, SkipBack, SkipForward } from 'lucide-react';
import { useAppStore } from '../state/appStore';

export function TimelineStrip() {
  const status = useAppStore((state) => state.generationStatus);
  const isTurntableEnabled = useAppStore((state) => state.isTurntableEnabled);
  const setTurntableEnabled = useAppStore((state) => state.setTurntableEnabled);

  return (
    <footer className="timeline-strip" aria-label="Generation timeline">
      <div className="timeline-status">
        <Circle size={10} fill="currentColor" aria-hidden="true" />
        <span>{status === 'preview-ready' ? 'Preview ready' : status}</span>
      </div>
      <div className="timeline-controls">
        <button
          className="camera-orbit-toggle"
          type="button"
          aria-pressed={isTurntableEnabled}
          title={isTurntableEnabled ? 'Pause turntable camera' : 'Play turntable camera'}
          onClick={() => setTurntableEnabled(!isTurntableEnabled)}
        >
          <Camera size={16} aria-hidden="true" />
          <Rotate3D size={15} aria-hidden="true" />
          <span className="sr-only">
            {isTurntableEnabled ? 'Pause turntable' : 'Play turntable'}
          </span>
        </button>
        <button type="button" title="Previous step">
          <SkipBack size={16} aria-hidden="true" />
        </button>
        <div className="timeline-track" aria-hidden="true">
          <span style={{ width: '22%' }} />
        </div>
        <button type="button" title="Next step">
          <SkipForward size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="timeline-metrics">
        <span>0 draw calls</span>
        <span>placeholder scene</span>
      </div>
    </footer>
  );
}
