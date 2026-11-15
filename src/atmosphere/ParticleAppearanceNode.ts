import type { Node } from 'three/webgpu';
import { Fn, color, float, mix } from 'three/tsl';
import { JET_STREAMS_MODEL } from './JetStreamsModel';

export const temperatureColorNode = Fn<[Node<'float'>], Node<'vec3'>>(([temperature]) => {
  const coolToViolet = mix(color(0x124bff), color(0x953de8), temperature.mul(2).clamp());
  return mix(coolToViolet, color(0xff102b), temperature.sub(.5).mul(2).clamp());
});

export const particleLifeFadeNode = Fn<[Node<'float'>], Node<'float'>>(([life]) => life.clamp(0, .24).div(.24));

export const jetTracerFadeNode = Fn<[Node<'float'>, Node<'float'>, Node<'vec2'>, Node<'float'>], Node<'float'>>(
  ([index, baseCount, lifecycle, strength]) => mix(float(1), strength
    .mul(lifecycle.x.smoothstep(0, JET_STREAMS_MODEL.tracerFadeSeconds)).mul(lifecycle.y),
  index.greaterThanEqual(baseCount).toFloat()),
);
