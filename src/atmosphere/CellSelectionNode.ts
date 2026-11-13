import type { Node } from 'three/webgpu';
import { Fn, float } from 'three/tsl';
import { HADLEY_MODEL } from './HadleyModel';

/** Cell ids 0–2 north, 3–5 south. Negative selection shows the whole model. */
export const cellFocusNode = Fn<[Node<'float'>, Node<'float'>], Node<'float'>>(
  ([latitude, selectedCell]) => {
    const cell = latitude.abs().div(HADLEY_MODEL.cellEdgeRadians).floor().min(2)
      .add(latitude.lessThan(0).select(3, 0));
    return selectedCell.lessThan(0).select(float(1),
      cell.sub(selectedCell).abs().lessThan(0.1).select(float(1.8), float(0.35)));
  },
);
