import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LifeScene, { type LifeSceneProps } from '../src/LifeScene';

const base: LifeSceneProps = { stage: 'university', age: 23, month: 3, running: true, focus: 'study', seed: 42, relationship: 'single' };
const render = (props: Partial<LifeSceneProps>) => renderToStaticMarkup(<LifeScene {...base} {...props}/>);

describe('animation context boundaries', () => {
  it('walks only outdoors alone and stops walking for a visitor, child or choice', () => {
    expect(render({ focus: 'connect' })).toContain('data-motion="stroll"');
    for (const props of [{ companionName: '동기' }, { children: 'young' as const }, { awaitingChoice: true }]) {
      expect(render({ focus: 'connect', ...props })).not.toContain('data-motion="stroll"');
    }
    expect(render({ stage: 'career', focus: 'connect' })).not.toContain('data-motion="stroll"');
  });
  it('uses a held cup only for rest and a held chart only for clinical paper work', () => {
    expect(render({ focus: 'rest' })).toContain('data-motion-prop="held-cup"');
    expect(render({ focus: 'rest', awaitingChoice: true })).not.toContain('data-motion-prop="held-cup"');
    expect(render({ stage: 'training' })).toContain('data-motion-prop="held-chart"');
    expect(render({ stage: 'training' })).not.toContain('data-desk-motion=');
    for (const props of [{}, { stage: 'career' as const }, { workContext: 'research' as const }]) expect(render(props)).not.toContain('data-motion-prop="held-chart"');
  });
  it('choice waiting always freezes the scene even if its caller is running', () => {
    const html = render({ awaitingChoice: true });
    expect(html).toContain('data-running="false"');
    expect(html).toContain('data-motion="wait"');
    expect(html).not.toContain('data-desk-motion=');
  });
  it('matches desk actions to actual work and removes them while resting or talking', () => {
    expect(render({})).toContain('data-desk-motion="reading"');
    expect(render({ stage: 'career' })).toContain('data-desk-motion="typing"');
    expect(render({ workContext: 'research' })).toContain('data-desk-motion="typing"');
    for (const focus of ['rest', 'connect'] as const) expect(render({ focus })).not.toContain('data-desk-motion=');
  });
  it('only shows child play for an actual young child in a shared living scene', () => {
    expect(render({ focus: 'rest', children: 'young' })).toContain('data-motion-prop="play-ball"');
    for (const children of ['none', 'school', 'adult'] as const) expect(render({ focus: 'rest', children })).not.toContain('data-motion-prop="play-ball"');
    expect(render({ children: 'young' })).not.toContain('data-motion-prop="play-ball"');
  });
});
