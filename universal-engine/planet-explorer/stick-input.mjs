/** Mobile joystick coordinates: pointer +X points right and +Y points down.
 * Touchscreen horizontal input is inverted relative to the world strafe axis.
 * Keyboard A/D remains unchanged; only touchscreen stick axes are corrected.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function joystickMovement(stick){
 const x=clamp(Number(stick?.x)||0,-1,1),y=clamp(Number(stick?.y)||0,-1,1);
 return {forward:-y,strafe:-x};
}
