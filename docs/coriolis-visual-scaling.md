# Coriolis visual scaling

The reduced zonal response uses `du/dt = f v − drag u`, with the prescribed meridional circulation maintained separately. The display angular velocity is 1.14 per display second; it is an educational time scaling, not Earth's physical angular velocity.

The physical latitude dependence `sin(latitude)` is retained. An additional, explicitly visual multiplier is 1 through ±60°, falls smoothly with smoothstep, and reaches 0.5 at ±90° (0.75 at ±75°). Both zonal acceleration and the longitude-rate safety limit use this multiplier. Thus low/midlatitude drift is unchanged while excessive polar winding is moderated. The base longitude cap is 0.44 radians per display second, reduced to 0.22 at the poles. This correction is symmetric in both hemispheres and does not change drift direction.
