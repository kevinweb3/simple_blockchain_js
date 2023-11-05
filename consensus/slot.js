"use strict";

export const delegates = 20;
export const interval = 3;

export function get_time(time) {
  if (time === undefined) {
    time = new Date().getTime();
  }

  const base_time = new Date(1548988864492).getTime();
  return Math.floor((time - base_time) / 1000);
}

export function get_slot_number(time_stamp) {
  time_stamp = get_time(time_stamp);
  return Math.floor(time_stamp / interval);
}
