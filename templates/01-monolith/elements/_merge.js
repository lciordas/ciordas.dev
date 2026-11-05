// Tiny merge helper so the elements do not need the larger utils module twice.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const mergeBufferGeometries = (list) => mergeGeometries(list, false);
