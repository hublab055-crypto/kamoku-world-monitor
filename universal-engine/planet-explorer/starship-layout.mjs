/** One physical docking floor for exterior geometry, cabin and camera. Metres. */
export const CABIN_FLOOR_M=2;
export const RAMP_START_Z=13.1;
export const RAMP_END_Z=18.5;
export const RAMP_WALK_HALF_WIDTH=.98; // 1.25m half width minus player radius
export function starshipFloorHeight(z){
 if(!Number.isFinite(z))throw RangeError("Invalid ramp coordinate");
 return CABIN_FLOOR_M*Math.max(0,Math.min(1,(RAMP_END_Z-z)/(RAMP_END_Z-RAMP_START_Z)));
}
// Ground forward is +Z; existing cabin forward is -Z with the opposite yaw sign.
export const cabinYawFromGround=(yaw,shipYaw)=>Math.PI+shipYaw-yaw;
export const groundYawFromCabin=(yaw,shipYaw)=>Math.PI+shipYaw-yaw;
