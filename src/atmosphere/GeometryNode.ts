import type { Node } from 'three/webgpu';
import { Fn } from 'three/tsl';
import { CONFIG } from '../config';
import { SHELL_THICKNESS_DIFFERENCE, SURFACE_CLEARANCE } from './geometry';

export const shellThicknessNode = Fn<[Node<'float'>], Node<'float'>>(([latitude]) =>
  latitude.cos().pow(2).mul(SHELL_THICKNESS_DIFFERENCE).add(CONFIG.atmosphere.polarShellThickness));

export const particleRadiusNode = Fn<[Node<'float'>, Node<'float'>], Node<'float'>>(([latitude, altitude]) =>
  altitude.mul(shellThicknessNode(latitude)).add(CONFIG.earth.radius + SURFACE_CLEARANCE));

export const radialVelocityNode = Fn<[Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>], Node<'float'>>(
  ([latitude, altitude, latitudeVelocity, altitudeVelocity]) => altitudeVelocity.mul(shellThicknessNode(latitude))
    .sub(altitude.mul(2 * SHELL_THICKNESS_DIFFERENCE).mul(latitude.cos()).mul(latitude.sin()).mul(latitudeVelocity)),
);
