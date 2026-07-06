import { Copy, Dice5 } from 'lucide-react';
import { useState } from 'react';
import { useAppStore, type CrystalSettings } from '../state/appStore';

type NumericSetting = {
  key: keyof Pick<
    CrystalSettings,
    | 'nucleationCount'
    | 'nucleusStartDelay'
    | 'nucleiVerticalSpread'
    | 'initialSeedSize'
    | 'crystalScale'
    | 'symmetryBias'
    | 'coolingRate'
    | 'edgeGrowthBias'
    | 'faceFillRate'
    | 'terraceHeight'
    | 'hopperDepth'
    | 'branchingProbability'
    | 'impurity'
    | 'gravitySagBias'
    | 'oxidationExposure'
    | 'oxideIntensity'
    | 'iridescenceThicknessRange'
    | 'surfaceRoughness'
    | 'scratchDetailStrength'
    | 'environmentIntensity'
  >;
  label: string;
  min: number;
  max: number;
  step: number;
};

const structureSettings: NumericSetting[] = [
  { key: 'nucleationCount', label: 'Nuclei', min: 1, max: 8, step: 1 },
  { key: 'nucleusStartDelay', label: 'Start delay', min: 0, max: 1, step: 0.01 },
  { key: 'nucleiVerticalSpread', label: 'Vertical spread', min: 0, max: 1, step: 0.01 },
  { key: 'initialSeedSize', label: 'Seed size', min: 0, max: 1, step: 0.01 },
  { key: 'crystalScale', label: 'Scale', min: 0.5, max: 1.6, step: 0.01 },
  { key: 'symmetryBias', label: 'Symmetry', min: 0, max: 1, step: 0.01 },
];

const growthSettings: NumericSetting[] = [
  { key: 'coolingRate', label: 'Cooling', min: 0, max: 1, step: 0.01 },
  { key: 'edgeGrowthBias', label: 'Edge bias', min: 0, max: 1, step: 0.01 },
  { key: 'faceFillRate', label: 'Face fill', min: 0, max: 1, step: 0.01 },
  { key: 'terraceHeight', label: 'Terraces', min: 0, max: 1, step: 0.01 },
  { key: 'hopperDepth', label: 'Hopper', min: 0, max: 1, step: 0.01 },
  { key: 'branchingProbability', label: 'Branching', min: 0, max: 1, step: 0.01 },
  { key: 'impurity', label: 'Impurity', min: 0, max: 1, step: 0.01 },
  { key: 'gravitySagBias', label: 'Sag', min: 0, max: 1, step: 0.01 },
  { key: 'oxidationExposure', label: 'Oxidation', min: 0, max: 1, step: 0.01 },
];

const renderSettings: NumericSetting[] = [
  { key: 'oxideIntensity', label: 'Oxide display', min: 0, max: 1, step: 0.01 },
  { key: 'iridescenceThicknessRange', label: 'Film range', min: 0, max: 1, step: 0.01 },
  { key: 'surfaceRoughness', label: 'Roughness', min: 0, max: 1, step: 0.01 },
  { key: 'scratchDetailStrength', label: 'Scratches', min: 0, max: 1, step: 0.01 },
  { key: 'environmentIntensity', label: 'Environment', min: 0, max: 1.5, step: 0.01 },
];

export function ControlRail() {
  const settings = useAppStore((state) => state.settings);
  const setSetting = useAppStore((state) => state.setSetting);
  const randomizeSeed = useAppStore((state) => state.randomizeSeed);
  const [copyLabel, setCopyLabel] = useState('Copy seed');

  async function copySeed() {
    await navigator.clipboard.writeText(settings.seed);
    setCopyLabel('Copied');
    window.setTimeout(() => setCopyLabel('Copy seed'), 1200);
  }

  return (
    <aside className="control-rail" aria-label="Generator controls">
      <section className="panel-section">
        <div className="section-heading">
          <h2>Seed</h2>
          <span>Serializable setup</span>
        </div>
        <label className="seed-field">
          <span>Seed value</span>
          <input
            value={settings.seed}
            onChange={(event) => setSetting('seed', event.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="icon-row">
          <button type="button" onClick={randomizeSeed} title="Randomize seed">
            <Dice5 size={17} aria-hidden="true" />
            <span>Randomize</span>
          </button>
          <button type="button" onClick={copySeed} title="Copy seed">
            <Copy size={17} aria-hidden="true" />
            <span>{copyLabel}</span>
          </button>
        </div>
      </section>

      <SliderGroup title="Structure" settings={structureSettings} values={settings} />
      <SliderGroup title="Growth" settings={growthSettings} values={settings} />
      <SliderGroup title="Render" settings={renderSettings} values={settings} />
    </aside>
  );
}

interface SliderGroupProps {
  title: string;
  settings: NumericSetting[];
  values: CrystalSettings;
}

function SliderGroup({ title, settings, values }: SliderGroupProps) {
  const setSetting = useAppStore((state) => state.setSetting);

  return (
    <section className="panel-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <span>{settings.length} controls</span>
      </div>
      <div className="slider-stack">
        {settings.map((setting) => {
          const value = values[setting.key];
          const displayValue = Number.isInteger(value) ? value : value.toFixed(2);

          return (
            <label className="slider-control" key={setting.key}>
              <span>
                {setting.label}
                <output>{displayValue}</output>
              </span>
              <input
                type="range"
                min={setting.min}
                max={setting.max}
                step={setting.step}
                value={value}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setSetting(setting.key, nextValue as never);
                }}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
