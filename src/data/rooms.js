// src/data/rooms.js

// small lift so labels don't clip into the floor
const Y_OFFSET = 0.15;

// raw coordinates you gave (y is vertical in R3F/three.js)
const ROOMS4_RAW = [
    { id: "413", x: -2.0,   y: 0.0,    z: -0.6 },
    { id: "415", x: -1.7,   y: 0.0,    z: -0.6 },
    { id: "417", x: -1.3,   y: 0.0,    z: -0.6 },
    { id: "419", x: -1.0,   y: 0.0,    z: -0.6 },
    { id: "421", x: -0.7,   y: 0.0,    z: -0.6 },
    { id: "422", x: -0.7,   y: -0.068, z: -0.3 },
    { id: "423", x: -0.4,   y: 0.0,    z: -0.6 },
    { id: "424", x: -0.4,   y: -0.068, z: -0.3 },
    { id: "442", x: -1.428, y: 0.0,    z:  0.6 },
    { id: "446", x: -0.9,   y: 0.0,    z:  0.6 },
    { id: "448", x: -0.5,   y: 0.0,    z:  0.6 },
    { id: "452", x: -0.2,   y: 0.0,    z:  0.6 },
    { id: "454", x:  0.0,   y: 0.0,    z:  0.6 },
    { id: "456", x:  0.3,   y: 0.0,    z:  0.6 },
    { id: "458", x:  0.76,  y: 0.0,    z:  0.6 },
    { id: "462", x:  1.12,  y: 0.0,    z:  0.6 },
];

export const ROOMS = {
    "4th floor": ROOMS4_RAW.map(r => ({ id: r.id, pos: [r.x, r.y + Y_OFFSET, r.z] })),
    "5th floor": [],
    "6th floor": [],
};

// optional color/status mapping you can fill later
export const STATUS_COLOR = {
    DEFAULT: "rgba(0,0,0,0.75)",
    OK: "rgba(36,180,126,0.9)",
    WARN: "rgba(255,165,0,0.9)",
    ALARM: "rgba(220,20,60,0.95)",
};
