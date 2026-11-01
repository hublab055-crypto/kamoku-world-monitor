/**
 * Walkable music hall locations + seats in the existing town interior frame.
 * Pure coordinates. No global world origin, renderer, or mutable state.
 */
export const MUSIC_HALL_SITES=Object.freeze([
 {type:"theater",x:0,z:48,angle:0},
 {type:"school",x:0,z:-48,angle:0}
]);
export const MUSIC_HALL_ROOMS=Object.freeze({
 theater:{halfWidth:8.3,zMin:-10.2,zMax:10.2,entranceZ:8.6,stageZ:-7.5},
 school:{halfWidth:5.5,zMin:-6.5,zMax:6.5,entranceZ:5.2,stageZ:-4.5}
});
export const HALL_SEATS=Object.freeze(Array.from({length:4},(_,row)=>
 [-5.4,-3.4,3.4,5.4].map(x=>Object.freeze({
  id:"seat-"+row+"-"+String(x).replace("-","m"),x,z:-2.6+row*2.25,
  yaw:Math.PI,seating:"theater"
 }))).flat());
export const SCHOOL_SEATS=Object.freeze(Array.from({length:3},(_,row)=>
 [-2.4,0,2.4].map(x=>Object.freeze({
  id:"school-seat-"+row+"-"+String(x).replace("-","m"),x,z:-.4+row*1.8,
  yaw:Math.PI,seating:"school"
 }))).flat());
export const hallRoom=type=>MUSIC_HALL_ROOMS[type]||null;
export const hallSeats=type=>type==="theater"?HALL_SEATS:type==="school"?SCHOOL_SEATS:[];
export function nearestHallSeat(type,pose,{reach=1.3}={}){
 if(!hallRoom(type)||!pose||!Number.isFinite(pose.x)||!Number.isFinite(pose.z))return null;
 const list=hallSeats(type);
 let chosen=null,distance=reach;
 for(const seat of list){
  const d=Math.hypot(pose.x-seat.x,pose.z-seat.z);
  if(d<=distance){chosen=seat;distance=d;}
 }
 return chosen;
}
export function hallOccupancy(type,count=7){
 const seats=hallSeats(type),n=Math.min(seats.length,Math.max(0,Math.floor(Number(count)||0)));
 // deterministic audience groups with center aisle clear
 return seats.slice(0,n);
}
