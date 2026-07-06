import { Camera, Circle, Rotate3D, SkipBack, SkipForward } from 'lucide-react';
import { useAppStore } from '../state/appStore';

export function TimelineStrip() {
  const status = useAppStore((state) => state.generationStatus);
  const progress = useAppStore((state) => state.generationProgress);
  const step = useAppStore((state) => state.generationStep);
  const model = useAppStore((state) => state.crystalModel);
  const previewBlocks = useAppStore((state) => state.previewBlocks);
  const isTurntableEnabled = useAppStore((state) => state.isTurntableEnabled);
  const setTurntableEnabled = useAppStore((state) => state.setTurntableEnabled);
  const blockCount = model?.stats.blockCount ?? previewBlocks.length;

  return (
    <footer className="timeline-strip" aria-label="Generation timeline">
      <div className="timeline-status">
        <Circle size={10} fill="currentColor" aria-hidden="true" />
        <span>
          {status === 'preview-ready' ? 'Preview ready' : status}
          {step !== 'idle' ? ` - ${step}` : ''}
        </span>
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
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <button type="button" title="Next step">
          <SkipForward size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="timeline-metrics">
        <span>{blockCount.toLocaleString()} blocks</span>
        <span>{model ? `${model.stats.triangleCountEstimate.toLocaleString()} tris est.` : 'streaming'}</span>
      </div>
    </footer>
  );
}
