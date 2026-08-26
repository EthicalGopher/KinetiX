function cameraOrientationToDegrees(orientation) {
    switch (orientation) {
        case 'up':
            return 0;
        case 'right':
            return 90;
        case 'down':
            return 180;
        case 'left':
            return 270;
    }
}
/**
 * Gets the signed rotation needed to keep UI elements upright relative to the
 * Camera output orientation.
 *
 * The result is normalized to the shortest cardinal rotation, with opposite
 * orientations represented as `180`.
 */
export function getUIRotation(outputOrientation, interfaceOrientation) {
    // Convert to degrees
    const outputOrientationDegrees = cameraOrientationToDegrees(outputOrientation);
    const interfaceOrientationDegrees = cameraOrientationToDegrees(interfaceOrientation);
    // Calculate difference, not overshooting 360°
    const rotation = (interfaceOrientationDegrees - outputOrientationDegrees + 360) % 360;
    const normalizedRotation = rotation % 360;
    if (normalizedRotation > 180) {
        // Converts 270° to -90°
        return normalizedRotation - 360;
    }
    else {
        return normalizedRotation;
    }
}
